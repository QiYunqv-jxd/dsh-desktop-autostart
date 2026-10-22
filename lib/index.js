// dsh-desktop-autostart 宿主端入口。
//
// v0.1 只把自启引擎挂出去；设置页的开关在 0.2 接上。这里刻意保持“加载即安全”：
// 模块被加载时不发生任何 I/O、不写启动项、不启动子进程，只有用户明确触发才会动。
//
// 一个插件在加载阶段抛异常会连累整个 profile 的插件列表，所以 apply 里不 throw。

import { DEFAULT_NAME, disable, enable, isSupported, readShortcut, resolveDesktopExecutable, shortcutPath, startupDir, status } from './autostart-win.js'

// 不依赖任何服务：宿主端没有路由、没有定时器，也就不需要 webServer 之类的注入。
export const inject = []

// 给后续的设置页 / 命令使用；单独引引擎时也能直接拿。
export const engine = { DEFAULT_NAME, disable, enable, isSupported, readShortcut, resolveDesktopExecutable, shortcutPath, startupDir, status }

export function apply(ctx) {
  // 目前没有需要挂载的东西。保留 apply 是为了让加载器看到完整插件，
  // 而不是一个“导入了但没入口”的损坏模块。
  void ctx
}
