import { Readable } from 'node:stream'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../lib/index.js'

process.env.DSH_AUTOSTART_STATE = join(tmpdir(), 'dsh-autostart-http-test.json')
const STATE = process.env.DSH_AUTOSTART_STATE
rmSync(STATE, { force: true })

const routes = []
const disposers = []
const webServer = {
  register(route) {
    routes.push(route)
    return () => {
      const index = routes.indexOf(route)
      if (index >= 0) routes.splice(index, 1)
    }
  }
}

const ctx = {
  get(name) { return name === 'webServer' ? webServer : undefined },
  on() {},
  off() {},
  effect(fn) { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose) },
  logger() { return { info() {}, warn() {} } },
  config() { return { enabled: false, name: 'dsh-autostart-panel-test.lnk' } }
}

apply(ctx, { enabled: false, name: 'dsh-autostart-panel-test.lnk' })

const find = (suffix) => routes.find((route) => route.path === '/dsh-desktop-autostart/' + suffix)

async function call(route, method, body) {
  if (!route) throw new Error('route missing')
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body), 'utf8')])
  req.method = method
  req.url = route.path
  let status = 0
  let payload = ''
  const res = {
    writeHead(code) { status = code },
    end(chunk) { if (chunk) payload += chunk.toString() },
    set statusCode(code) { status = code }
  }
  await route.handler(req, res)
  return { status, json: payload ? JSON.parse(payload) : null }
}

const state = await call(find('state'), 'GET')
const on = await call(find('apply'), 'POST', { enabled: true })
const off = await call(find('apply'), 'POST', { enabled: false })
const bad = await call(find('apply'), 'POST', {})
const scan = await call(find('scan'), 'GET')

const problems = []
if (routes.length !== 3) problems.push(`routes=${routes.length}`)
if (state.status !== 200 || state.json.ok !== true) problems.push('state failed')
if (state.json.name !== 'dsh-autostart-panel-test.lnk') problems.push('name mismatch')
if (on.status !== 200 || on.json.ok !== true || on.json.enabled !== true) problems.push('enable failed')
if (!/dsh-autostart-panel-test\.lnk$/i.test(on.json.path || '')) problems.push('path mismatch')
if (off.status !== 200 || off.json.ok !== true || off.json.enabled !== false) problems.push('disable failed')
if (bad.status !== 400) problems.push(`bad payload status=${bad.status}`)
if (scan.status !== 200 || scan.json.ok !== true) problems.push('scan failed')
if (!Array.isArray(scan.json.others)) problems.push('scan others not array')

console.log(JSON.stringify({
  ok: problems.length === 0,
  stateFile: STATE,
  routes: routes.map((route) => route.path),
  state,
  on,
  off,
  bad,
  scan,
  problems
}, null, 2))
process.exit(problems.length === 0 ? 0 : 1)
