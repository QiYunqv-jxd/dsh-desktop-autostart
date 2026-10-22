import { execFile } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PS1 = join(HERE, 'shortcut.ps1')

export const DEFAULT_NAME = 'DeepSeek Harness.lnk'

const BAD_CHARS = /[<>:"|?*]/
const CONTROL_CHARS = /[\x00-\x1f]/
const RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul', 'clock$',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
])

export function isSupported() {
  return process.platform === 'win32'
}

export function startupDir() {
  const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
  return join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
}

function validateName(name) {
  const n = String(name || '').trim()
  if (!n) throw new Error('快捷方式名不能为空')
  if (n.includes('/') || n.includes('\\') || n.includes('..')) throw new Error(`快捷方式名不能包含路径：${n}`)
  if (BAD_CHARS.test(n)) throw new Error(`快捷方式名含非法字符：${n}`)
  if (CONTROL_CHARS.test(n)) throw new Error(`快捷方式名含控制字符：${n}`)
  if (!/\.lnk$/i.test(n)) throw new Error(`快捷方式名必须以 .lnk 结尾：${n}`)
  if (n.length > 80) throw new Error(`快捷方式名太长：${n.length} 个字符`)
  if (RESERVED_NAMES.has(n.split('.')[0].toLowerCase())) throw new Error(`快捷方式名是 Windows 保留名：${n}`)
  return n
}

export function shortcutPath(name = DEFAULT_NAME) {
  const safe = validateName(name)
  const dir = startupDir()
  const full = join(dir, safe)
  const rel = relative(dir, full)
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) {
    throw new Error(`路径越界：${full}`)
  }
  return full
}

function runPowerShell(args, { timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', PS1, ...args],
      { timeout, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`shortcut.ps1 ${args[0]} 失败：${(stderr || stdout || error.message || '').trim()}`))
          return
        }
        resolve(stdout)
      }
    )
  })
}

function parseJson(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean)
  let line = null
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trimStart().startsWith('{')) {
      line = lines[i]
      break
    }
  }
  if (!line) line = lines[lines.length - 1]
  if (!line) throw new Error('shortcut.ps1 没有输出')
  return JSON.parse(line)
}

export function normalizePath(value) {
  const raw = String(value || '').trim().replace(/^"|"$/g, '')
  if (!raw) return ''
  return raw.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
}

function toBackslashes(value) {
  return String(value || '').replace(/\//g, '\\')
}

export function resolveDesktopExecutable() {
  const envTarget = process.env.DSH_DESKTOP_EXE
  if (envTarget && /\.exe$/i.test(envTarget) && existsSync(envTarget)) return toBackslashes(envTarget)

  const execPath = process.execPath
  if (execPath && existsSync(execPath) && /\.exe$/i.test(execPath) && !/^node(\.exe)?$/i.test(basename(execPath))) {
    return execPath
  }
  return null
}

export async function readShortcut({ name = DEFAULT_NAME } = {}) {
  const path = shortcutPath(name)
  const parsed = parseJson(await runPowerShell(['-Action', 'read', '-LnkPath', path]))
  return { ...parsed, path }
}

export async function enable({ name = DEFAULT_NAME, target = null, workingDirectory = null, description = 'DeepSeek Harness (logon autostart)' } = {}) {
  if (!isSupported()) throw new Error('登录自启只支持 Windows')

  const executable = toBackslashes(target || resolveDesktopExecutable())
  if (!executable) throw new Error('找不到桌面版程序，可用 DSH_DESKTOP_EXE 指定')
  if (!/\.exe$/i.test(executable)) throw new Error(`目标必须是 .exe：${executable}`)
  if (!existsSync(executable)) throw new Error(`程序不存在：${executable}`)

  const path = shortcutPath(name)
  const existed = existsSync(path)
  const workdir = toBackslashes(workingDirectory || dirname(executable))
  const desc = String(description || '').replace(/["\x00-\x1f]/g, ' ').slice(0, 128)

  await runPowerShell(['-Action', 'create', '-LnkPath', path, '-TargetPath', executable, '-WorkingDirectory', workdir, '-Description', desc])

  const written = await readShortcut({ name })
  if (!written.exists) throw new Error('快捷方式写不进去，可能被安全软件拦了')
  if (normalizePath(written.target) !== normalizePath(executable)) {
    throw new Error(`快捷方式目标不对：写入 ${executable}，读到 ${written.target}`)
  }
  return { ok: true, path, target: executable, created: !existed }
}

export async function disable({ name = DEFAULT_NAME } = {}) {
  if (!isSupported()) throw new Error('登录自启只支持 Windows')

  const path = shortcutPath(name)
  const parsed = parseJson(await runPowerShell(['-Action', 'remove', '-LnkPath', path]))
  if (parsed.exists) {
    try { rmSync(path, { force: true }) } catch {}
  }
  const after = await readShortcut({ name })
  if (after.exists) throw new Error(`删除失败：${path}`)
  return { ok: true, path, removed: parsed.removed !== false || !after.exists }
}

export async function status({ name = DEFAULT_NAME } = {}) {
  if (!isSupported()) return { ok: false, supported: false, platform: process.platform }
  try {
    const current = await readShortcut({ name })
    const expected = resolveDesktopExecutable()
    const matches = Boolean(current.exists && expected && normalizePath(current.target) === normalizePath(expected))
    return {
      ok: true,
      supported: true,
      enabled: Boolean(current.exists),
      matches,
      path: current.path,
      target: current.exists ? current.target : null,
      expected: expected || null,
      startupDir: startupDir()
    }
  } catch (error) {
    return { ok: false, supported: true, error: String(error?.message || error) }
  }
}
