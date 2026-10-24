import { existsSync, rmSync } from 'node:fs'
import { disable, enable, shortcutPath } from '../lib/autostart-win.js'

const TEST = 'dsh-autostart-own-test.lnk'
const DECOY = 'dsh-autostart-decoy-test.lnk'
const NOTEPAD = 'C:\\Windows\\System32\\notepad.exe'

const results = []
function check(label, ok, detail = '') {
  results.push({ label, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  -> ' + detail : ''}`)
}

process.env.DSH_DESKTOP_EXE = 'D:\\DeepSeek Harness\\DeepSeek Harness.exe'

const own = await enable({ name: TEST })
const removedOwn = await disable({ name: TEST })
check('removes its own shortcut', own.ok === true && removedOwn.ok === true)
check('own shortcut gone', existsSync(shortcutPath(TEST)) === false)

await enable({ name: DECOY, target: NOTEPAD })
let refused = ''
try {
  await disable({ name: DECOY })
} catch (error) {
  refused = String(error?.message || error)
}
check('refuses to delete a shortcut pointing elsewhere', /不是本插件建的/.test(refused), refused)
check('decoy file untouched', existsSync(shortcutPath(DECOY)) === true)
rmSync(shortcutPath(DECOY), { force: true })
check('decoy cleaned up by hand', existsSync(shortcutPath(DECOY)) === false)

const failed = results.filter((item) => !item.ok)
console.log(failed.length ? `\n${failed.length} check(s) failed` : '\nall checks passed')
process.exit(failed.length ? 1 : 0)
