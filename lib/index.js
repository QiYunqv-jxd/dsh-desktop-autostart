import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_NAME, disable, enable, isSupported, readShortcut, resolveDesktopExecutable, scanOtherAutostarts, shortcutPath, startupDir, status } from './autostart-win.js'

export const inject = ['webServer']

export const engine = { DEFAULT_NAME, disable, enable, isSupported, readShortcut, resolveDesktopExecutable, scanOtherAutostarts, shortcutPath, startupDir, status }

export const Config = z.object({
  enabled: z
    .boolean()
    .default(false)
    .description('登录 Windows 时自动启动 DeepSeek Harness。打开会写入启动文件夹，关闭会删掉那条快捷方式；保存后立即生效。')
    .volatile(),
  name: z
    .string()
    .default(DEFAULT_NAME)
    .description('启动文件夹里那条快捷方式的文件名，须以 .lnk 结尾。改了名字不会删旧的，先把旧开关关掉再启用新名字。')
    .volatile()
})

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const ROUTE_BASE = '/dsh-desktop-autostart'

function stateFile() {
  return process.env.DSH_AUTOSTART_STATE || path.join(DSH_HOME, 'dsh-desktop-autostart.json')
}

function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
    if (parsed && typeof parsed === 'object') return parsed
  } catch {}
  return {}
}

function writeState(next) {
  try {
    const target = stateFile()
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, JSON.stringify(next, null, 2) + '\n', 'utf8')
    return true
  } catch {
    return false
  }
}

function unwrap(value) {
  if (value && typeof value === 'object' && typeof value.get === 'function') {
    try {
      return value.get()
    } catch {}
  }
  return value
}

function readLive(ctx, fallback) {
  try {
    const value = typeof ctx.config === 'function' ? ctx.config() : ctx.config
    if (value && typeof value === 'object') return { ...fallback, ...value }
  } catch {}
  return fallback
}

function pickName(live) {
  const name = unwrap(live.name)
  return typeof name === 'string' && name.trim() ? name.trim() : DEFAULT_NAME
}

function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (viaGet) return viaGet
  } catch {}
  return ctx.webServer
}

function sendJson(res, code, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': String(body.length)
  })
  res.end(body)
}

function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        req.destroy()
        resolve(null)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch {
        resolve(null)
      }
    })
    req.on('error', () => resolve(null))
  })
}

export function apply(ctx, config = {}) {
  if (!isSupported()) return
  const logger = ctx.logger?.('desktop-autostart')

  let lastEnabled = unwrap(config.enabled) === true
  let busy = false
  let queued = false

  const desired = () => {
    const state = readState()
    if (typeof state.enabled === 'boolean') return state.enabled
    return unwrap(readLive(ctx, config).enabled) === true
  }

  const activate = async (wanted, name) => {
    const result = wanted ? await enable({ name }) : await disable({ name })
    lastEnabled = wanted
    logger?.info?.(wanted ? `login autostart on: ${result.path}` : `login autostart off: ${result.path}`)
    return result
  }

  const run = async () => {
    if (busy) {
      queued = true
      return
    }
    busy = true
    try {
      const live = readLive(ctx, config)
      const wanted = unwrap(live.enabled) === true
      if (wanted === lastEnabled) return
      await activate(wanted, pickName(live))
    } catch (error) {
      logger?.warn?.(`login autostart failed: ${error?.message || error}`)
    } finally {
      busy = false
      if (queued) {
        queued = false
        void run()
      }
    }
  }

  const onDocumentUpdated = (namespace) => {
    if (namespace && namespace !== 'desktop-autostart' && namespace !== 'dsh-desktop-autostart') return
    void run()
  }

  ctx.on?.('settings/document-updated', onDocumentUpdated)
  ctx.effect?.(() => () => {
    ctx.off?.('settings/document-updated', onDocumentUpdated)
  })

  if (desired()) {
    void enable({ name: readState().name || pickName(config) }).then(
      (result) => logger?.info?.(`login autostart verified: ${result.path}`),
      (error) => logger?.warn?.(`login autostart not repaired: ${error?.message || error}`)
    )
  }

  const webServer = resolveWebServer(ctx)
  if (!webServer || typeof webServer.register !== 'function') {
    logger?.warn?.('no webServer, settings panel stays hidden')
    return
  }

  const guard = (req, res) => {
    try {
      const connection = (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) || ctx.connection
      if (!connection || typeof connection.requestRejection !== 'function') return false
      const code = connection.requestRejection(req)
      if (code === undefined || code === null || code === false) return false
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return true
    } catch {
      return false
    }
  }

  const route = (pathName, handler) =>
    webServer.register({
      kind: 'exact',
      path: pathName,
      handler: async (req, res) => {
        if (guard(req, res)) return
        try {
          await handler(req, res)
        } catch (error) {
          sendJson(res, 500, { ok: false, error: String(error?.message || error) })
        }
      }
    })

  const currentName = () => pickName(readLive(ctx, config))

  const disposers = [
    route(`${ROUTE_BASE}/state`, async (req, res) => {
      const name = currentName()
      const snapshot = await status({ name })
      sendJson(res, 200, { ...snapshot, desired: desired(), name, route: ROUTE_BASE })
    }),
    route(`${ROUTE_BASE}/scan`, async (req, res) => {
      const result = await scanOtherAutostarts()
      sendJson(res, 200, { ...result, name: currentName() })
    }),
    route(`${ROUTE_BASE}/apply`, async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: '只接受 POST' })
        return
      }
      const payload = await readJson(req)
      if (!payload || typeof payload.enabled !== 'boolean') {
        sendJson(res, 400, { ok: false, error: '缺少 enabled' })
        return
      }
      const name = currentName()
      await activate(payload.enabled, name)
      writeState({ enabled: payload.enabled, name })
      const snapshot = await status({ name })
      sendJson(res, 200, { ...snapshot, desired: payload.enabled, name })
    })
  ]

  ctx.effect?.(() => () => {
    for (const dispose of disposers) {
      try {
        if (typeof dispose === 'function') dispose()
      } catch {}
    }
  })
}
