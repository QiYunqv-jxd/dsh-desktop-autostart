// 自检：用一次性名字跑一遍 开启 → 复核 → 关闭，不碰真实启动项。
// 期望最后一行 ok:true。

import assert from 'node:assert/strict'
import { DEFAULT_NAME, disable, enable, normalizePath, readShortcut, resolveDesktopExecutable, startupDir, status } from '../lib/autostart-win.js'

const TEST_NAME = 'dsh-autostart-selftest.lnk'
const TARGET = process.env.DSH_DESKTOP_EXE || resolveDesktopExecutable()

const report = { platform: process.platform, startupDir: startupDir(), steps: [] }

report.steps.push({ step: 'resolve', execPath: process.execPath, desktop: resolveDesktopExecutable(), target: TARGET })

if (!TARGET) {
  // 在 node.exe 下跑时拿不到桌面版路径；这不是失败，只是这台机器上没法做完整往返。
  report.ok = true
  report.skipped = 'desktop executable not found (run inside the DSH desktop app, or set DSH_DESKTOP_EXE, to run the full round-trip)'
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

const before = await readShortcut({ name: TEST_NAME })
assert.equal(before.exists, false, '测试名启动项应为空')

const on = await enable({ name: TEST_NAME, target: TARGET })
report.steps.push({ step: 'enable', ...on })

const onState = await readShortcut({ name: TEST_NAME })
assert.equal(onState.exists, true)
// 与 enable 内同一套归一化口径比较，避免正斜杠/大小写差异造成误报。
assert.equal(normalizePath(onState.target), normalizePath(TARGET), `读回目标应为 ${TARGET}，实际 ${onState.target}`)

const off = await disable({ name: TEST_NAME })
report.steps.push({ step: 'disable', ...off })

const offState = await readShortcut({ name: TEST_NAME })
assert.equal(offState.exists, false, '关闭后不应残留')

report.realEntry = await status({ name: DEFAULT_NAME })
report.ok = true
console.log(JSON.stringify(report, null, 2))
