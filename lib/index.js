import { DEFAULT_NAME, disable, enable, isSupported, readShortcut, resolveDesktopExecutable, shortcutPath, startupDir, status } from './autostart-win.js'

export const inject = []

export const engine = { DEFAULT_NAME, disable, enable, isSupported, readShortcut, resolveDesktopExecutable, shortcutPath, startupDir, status }

export function apply(ctx) {
  void ctx
}
