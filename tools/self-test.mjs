// 自检：用一次性名字跑一遍 开启 → 复核 → 关闭，不碰真实启动项。
// 期望最后一行 ok:true。

import assert from 'node:assert/strict'
import { DEFAULT_NAME, disable, enable, readShortcut, resolveDesktopExecutable, startupDir, status } from '../lib/autostart-win.js'

const TEST_NAME = 'dsh-autostart-selftest.lnk'
const TARGET = 'D:\\DeepSeek Harness\\DeepSeek Harness.exe'

const report = { platform: process.platform, startupDir: startupDir(), steps: [] }

report.steps.push({ step: 'resolve', execPath: process.execPath, desktop: resolveDesktopExecutable() })

const before = await readShortcut({ name: TEST_NAME })
assert.equal(before.exists, false, '测试名启动项应为空')

const on = await enable({ name: TEST_NAME, target: TARGET })
report.steps.push({ step: 'enable', ...on })

const onState = await readShortcut({ name: TEST_NAME })
assert.equal(onState.exists, true)
assert.equal(onState.target.toLowerCase(), TARGET.toLowerCase())

const off = await disable({ name: TEST_NAME })
report.steps.push({ step: 'disable', ...off })

const offState = await readShortcut({ name: TEST_NAME })
assert.equal(offState.exists, false, '关闭后不应残留')

report.realEntry = await status({ name: DEFAULT_NAME })
report.ok = true
console.log(JSON.stringify(report, null, 2))
