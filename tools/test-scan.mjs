import { execFileSync } from 'node:child_process'
import { scanOtherAutostarts } from '../lib/autostart-win.js'

const KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const NAME = 'DSHScanSelfTest'
const FAKE = '"C:\\Fake\\DeepSeek Harness\\DeepSeek Harness.exe" --selftest'

const results = []
function check(label, ok, detail = '') {
  results.push({ label, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  -> ' + detail : ''}`)
}
function reg(...args) {
  execFileSync('reg.exe', args, { stdio: 'pipe' })
}

const before = await scanOtherAutostarts()
check('scan returns ok', before.ok === true, before.error || '')
check('others is an array', Array.isArray(before.others), `count=${(before.others || []).length}`)
check('no self-test entry before', !(before.others || []).some((item) => item.name === NAME))
for (const item of before.others || []) {
  console.log(`  existing: ${item.source} | ${item.name} | ${item.command}`)
}

let detected = null
try {
  reg('add', KEY, '/v', NAME, '/t', 'REG_SZ', '/d', FAKE, '/f')
  const after = await scanOtherAutostarts()
  detected = (after.others || []).find((item) => item.name === NAME) || null
  check('detects entry added to HKCU Run', Boolean(detected), detected ? `${detected.source} | ${detected.command}` : '')
  check('entry reported as current program', Boolean(detected && detected.sameTarget === false), 'fake path, so sameTarget=false is expected')
} finally {
  try {
    reg('delete', KEY, '/v', NAME, '/f')
  } catch {}
}

const cleaned = await scanOtherAutostarts()
check('self-test entry removed again', !(cleaned.others || []).some((item) => item.name === NAME))

const failed = results.filter((item) => !item.ok)
console.log(failed.length ? `\n${failed.length} check(s) failed` : '\nall checks passed')
process.exit(failed.length ? 1 : 0)
