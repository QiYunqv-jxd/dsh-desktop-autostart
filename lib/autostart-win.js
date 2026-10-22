// dsh-desktop-autostart —— Windows 登录自启核心。
//
// 只做一件事：管理「当前用户 · 启动」文件夹里的那一个快捷方式。
// 不写注册表、不需要管理员权限、不额外常驻进程——桌面版本身就是 GUI，
// 登录后由 Explorer 直接把它拉起来。
//
// 这里不依赖 DSH 的任何服务，可以单独跑（tools/self-test.mjs 就是证据）。

import { execFile } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PS1 = join(HERE, 'shortcut.ps1')

/** 默认管理的快捷方式名。与用户手工建的启动项同名，因此天然复用、不会重复。 */
export const DEFAULT_NAME = 'DeepSeek Harness.lnk'

export function isSupported() {
  return process.platform === 'win32'
}

export function startupDir() {
  const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
  return join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
}

const WINDOWS_BAD_CHARS = /[<>:"|?*]/

/**
 * name 只允许是「启动文件夹里的一个普通文件名」：不允许任何路径分隔符，
 * 不允许 Windows 保留字符，且必须以 .lnk 结尾。设置页等外部输入一律过这里，
 * 否则 `..\..\Desktop\x.lnk` 这类名字会写出启动文件夹、甚至删到外面的文件。
 */
function validateName(name) {
  const n = String(name || '').trim()
  if (!n) throw new Error('快捷方式名不能为空')
  if (n.includes('/') || n.includes('\\') || n.includes('..')) throw new Error(`非法快捷方式名（含路径成分）：${n}`)
  if (WINDOWS_BAD_CHARS.test(n)) throw new Error(`非法快捷方式名（含 Windows 保留字符）：${n}`)
  if (!/\.lnk$/i.test(n)) throw new Error(`快捷方式名必须以 .lnk 结尾：${n}`)
  return n
}

export function shortcutPath(name = DEFAULT_NAME) {
  const safe = validateName(name)
  const dir = startupDir()
  const full = join(dir, safe)
  // 双保险：哪怕上面漏判，最终路径也必须在启动文件夹之内。
  const rel = relative(dir, full)
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) {
    throw new Error(`快捷方式路径越出启动文件夹：${full}`)
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
          const detail = (stderr || stdout || error.message || '').trim()
          reject(new Error(`shortcut.ps1 ${args[0]} failed: ${detail}`))
          return
        }
        resolve(stdout)
      }
    )
  })
}

function parseJson(text) {
  const line = String(text || '').trim().split(/\r?\n/).filter(Boolean).pop()
  if (!line) throw new Error('shortcut.ps1 produced no output')
  return JSON.parse(line)
}

function normalizePath(value) {
  const raw = String(value || '').trim().replace(/^"|"$/g, '')
  if (!raw) return ''
  // WScript.Shell 存回的目标一律是反斜杠，而调用方可能给正斜杠（例如环境变量里），
  // 比较前先统一分隔符，否则“写入成功但读回校验失败”会误报。
  return raw.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
}

/** 把可能的正斜杠统一成反斜杠再写入，保持 .lnk 里的路径和 Windows 习惯一致。 */
function toBackslashes(value) {
  return String(value || '').replace(/\//g, '\\')
}

/**
 * 桌面版可执行文件。插件在 host 进程里跑，host 就是那个 Electron 可执行文件；
 * 网页版（dsh web）下这里是 node.exe，要明确拒绝而不是悄悄写一个错的自启项。
 */
export function resolveDesktopExecutable() {
  const envTarget = process.env.DSH_DESKTOP_EXE
  if (envTarget && /\.exe$/i.test(envTarget) && existsSync(envTarget)) return toBackslashes(envTarget)

  const execPath = process.execPath
  if (execPath && existsSync(execPath) && /\.exe$/i.test(execPath) && !/^node(\.exe)?$/i.test(basename(execPath))) {
    return execPath
  }
  return null
}

/** 读一个快捷方式；不存在时返回 { exists: false }。 */
export async function readShortcut({ name = DEFAULT_NAME } = {}) {
  const path = shortcutPath(name)
  const parsed = parseJson(await runPowerShell(['-Action', 'read', '-LnkPath', path]))
  return { ...parsed, path }
}

/**
 * 创建（或复用）登录自启项。
 * @returns {Promise<{ok:true, path:string, target:string, created:boolean}>}
 */
export async function enable({ name = DEFAULT_NAME, target = null, workingDirectory = null, description = 'DeepSeek Harness (logon autostart)' } = {}) {
  if (!isSupported()) throw new Error('登录自启目前只支持 Windows')

  const executable = toBackslashes(target || resolveDesktopExecutable())
  if (!executable) {
    throw new Error('无法定位桌面版程序（当前进程不是桌面版，请用 DSH_DESKTOP_EXE 指定 exe 路径）')
  }
  if (!/\.exe$/i.test(executable)) throw new Error(`目标必须是 .exe：${executable}`)
  if (!existsSync(executable)) throw new Error(`桌面版程序不存在：${executable}`)

  const path = shortcutPath(name)
  const existed = existsSync(path)
  const workdir = toBackslashes(workingDirectory || dirname(executable))

  const psArgs = ['-Action', 'create', '-LnkPath', path, '-TargetPath', executable, '-WorkingDirectory', workdir, '-Description', description]
  await runPowerShell(psArgs)

  const written = await readShortcut({ name })
  if (!written.exists) throw new Error('快捷方式写入后读不到，启动文件夹可能被安全软件拦截')
  if (normalizePath(written.target) !== normalizePath(executable)) {
    throw new Error(`快捷方式目标不符：写入 ${executable}，读到 ${written.target}`)
  }
  return { ok: true, path, target: executable, created: !existed }
}

/** 删除登录自启项；本来就没有也视为成功。 */
export async function disable({ name = DEFAULT_NAME } = {}) {
  if (!isSupported()) throw new Error('登录自启目前只支持 Windows')
  const path = shortcutPath(name)
  const parsed = parseJson(await runPowerShell(['-Action', 'remove', '-LnkPath', path]))
  if (parsed.exists) {
    // PowerShell 删除失败时兜底一次（通常是权限/占用）。
    try { rmSync(path, { force: true }) } catch {}
  }
  const after = await readShortcut({ name })
  if (after.exists) throw new Error(`删除启动项失败：${path}`)
  return { ok: true, path, removed: parsed.removed !== false || !after.exists }
}

/** 当前状态：有没有、指向谁、指向的是不是这台机器上的桌面版。设置页高频轮询用，不抛错。 */
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
