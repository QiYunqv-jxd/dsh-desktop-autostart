import assert from 'node:assert/strict'
import { DEFAULT_NAME, disable, enable, normalizePath, readShortcut, resolveDesktopExecutable, startupDir, status } from '../lib/autostart-win.js'

const TEST_NAME = 'dsh-autostart-selftest.lnk'
const TARGET = process.env.DSH_DESKTOP_EXE || resolveDesktopExecutable()

const report = { platform: process.platform, startupDir: startupDir(), steps: [] }
report.steps.push({ step: 'resolve', execPath: process.execPath, desktop: resolveDesktopExecutable(), target: TARGET })

if (!TARGET) {
  report.ok = true
  report.skipped = 'desktop executable not found (set DSH_DESKTOP_EXE to run the full round-trip)'
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

const before = await readShortcut({ name: TEST_NAME })
assert.equal(before.exists, false)

const on = await enable({ name: TEST_NAME, target: TARGET })
report.steps.push({ step: 'enable', ...on })

const onState = await readShortcut({ name: TEST_NAME })
assert.equal(onState.exists, true)
assert.equal(normalizePath(onState.target), normalizePath(TARGET))

const off = await disable({ name: TEST_NAME })
report.steps.push({ step: 'disable', ...off })

const offState = await readShortcut({ name: TEST_NAME })
assert.equal(offState.exists, false)

report.realEntry = await status({ name: DEFAULT_NAME })
report.ok = true
console.log(JSON.stringify(report, null, 2))
