import assert from 'node:assert/strict'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Config, apply, engine } from '../lib/index.js'

process.env.DSH_DESKTOP_EXE = 'D:\\DeepSeek Harness\\DeepSeek Harness.exe'
process.env.DSH_AUTOSTART_STATE = join(tmpdir(), 'dsh-autostart-settings-test.json')
rmSync(process.env.DSH_AUTOSTART_STATE, { force: true })

const dir = engine.startupDir()
const name = 'dsh-autostart-settings-test.lnk'
const path = join(dir, name)

function fakeCtx(getConfig) {
  const handlers = new Map()
  const disposers = []
  const logs = []
  return {
    ctx: {
      config: getConfig,
      on(event, cb) {
        if (!handlers.has(event)) handlers.set(event, [])
        handlers.get(event).push(cb)
      },
      off(event, cb) {
        const list = handlers.get(event) || []
        const i = list.indexOf(cb)
        if (i >= 0) list.splice(i, 1)
      },
      effect(fn) {
        const dispose = fn()
        if (typeof dispose === 'function') disposers.push(dispose)
      },
      logger: () => ({
        info: (m) => logs.push(['info', m]),
        warn: (m) => logs.push(['warn', m])
      })
    },
    emit(event) {
      for (const cb of handlers.get(event) || []) cb('desktop-autostart')
    },
    emitAs(namespace) {
      for (const cb of handlers.get('settings/document-updated') || []) cb(namespace)
    },
    logs
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(predicate, timeout = 60000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (predicate()) return true
    await sleep(250)
  }
  return predicate()
}

const plain = (v) => (v && typeof v === 'object' && typeof v.get === 'function' ? v.get() : v)

const defaults = Config({})
assert.equal(plain(defaults.enabled), false)
assert.equal(plain(defaults.name), 'DeepSeek Harness.lnk')

// The settings form hands the plugin volatile accessors, not plain values.
const volatile = (v) => ({ get: () => v })

let live = { enabled: false, name }
const fake = fakeCtx(() => live)

// Load with "off": nothing must be touched, even if a hand-made entry exists.
apply(fake.ctx, { enabled: false, name })
await sleep(50)
assert.equal(existsSync(path), false, 'load must not create anything')

// Flip on through the settings document.
live = { enabled: volatile(true), name: volatile(name) }
fake.emit('settings/document-updated')
const created = await waitFor(() => existsSync(path))
if (!created) console.error('enable failed, logs: ' + JSON.stringify(fake.logs))
assert.equal(created, true, 'switch on must create the shortcut')
const onState = await engine.status({ name })
assert.equal(onState.enabled, true)

// Regression (2026-10-24): another plugin's settings update must not turn us off.
live = { enabled: volatile(false), name: volatile(name) }
fake.emitAs('fonttune')
await sleep(3000)
assert.equal(existsSync(path), true, 'foreign settings update must not remove the shortcut')
live = { enabled: volatile(true), name: volatile(name) }
fake.emitAs('dsh-fonttune')
await sleep(3000)
assert.equal(existsSync(path), true, 'foreign settings update must not remove the shortcut')

// Flip off.
live = { enabled: volatile(false), name: volatile(name) }
fake.emit('settings/document-updated')
const gone = await waitFor(() => !existsSync(path))
if (!gone) console.error('disable failed, logs: ' + JSON.stringify(fake.logs))
assert.equal(gone, true, 'switch off must remove the shortcut')

// A same-value update must not churn the filesystem.
live = { enabled: volatile(false), name: volatile(name) }
fake.emit('settings/document-updated')
await sleep(1500)
assert.equal(existsSync(path), false)

console.log(JSON.stringify({ ok: true, defaults: { enabled: plain(defaults.enabled), name: plain(defaults.name) }, logs: fake.logs }, null, 2))

