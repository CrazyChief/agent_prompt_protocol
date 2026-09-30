#!/usr/bin/env node
// The end-to-end suite in one call: probe the environment first, then run, then print a verdict.
//
//   node scripts/agent/e2e.mjs                full suite
//   node scripts/agent/e2e.mjs <filter…>      only matching specs/tests (the filter goes to e2e.scopedCmd)
//   node scripts/agent/e2e.mjs --probe        environment probes only (used by qa-preflight)
//
// Output: `e2e  N passed · N failed · N skipped · N did not run`, then the failing tests by name.
// "did not run" (skipped) counts as a failure: a test that never ran proved nothing. A filter that
// matches nothing is a failure too. Missing environment → `BLOCKED: environment not here`, exit 3.

import { sh, loadConfig, tempReport, readJUnit, q } from './lib.mjs'
import net from 'node:net'

const cfg = loadConfig().e2e ?? {}
const args = process.argv.slice(2)
const probeOnly = args.includes('--probe')
const filter = args.filter((a) => a !== '--probe')

async function probe(p) {
  if (p.url) {
    try {
      const r = await fetch(p.url, { signal: AbortSignal.timeout(5000), redirect: 'manual' })
      return r.status < 500
    } catch {
      return false
    }
  }
  if (p.tcp) {
    const [host, port] = p.tcp.split(':')
    return new Promise((res) => {
      const s = net.connect({ host, port: Number(port), timeout: 3000 }, () => { s.destroy(); res(true) })
      s.on('error', () => res(false))
      s.on('timeout', () => { s.destroy(); res(false) })
    })
  }
  if (p.cmd) return sh(p.cmd).ok
  return false
}

const results = []
for (const p of cfg.probes ?? []) results.push({ name: p.name, ok: await probe(p) })
const down = results.filter((r) => !r.ok)
console.log(`probes   ${results.map((r) => `${r.name} ${r.ok ? 'up' : 'DOWN'}`).join(' · ') || '(none configured)'}`)
if (down.length) {
  console.log(`BLOCKED: environment not here (${down.map((d) => d.name).join(', ')})`)
  process.exit(3)
}
if (probeOnly) process.exit(0)

const report = tempReport('e2e')
const template = filter.length ? cfg.scopedCmd : cfg.cmd
if (!template) {
  console.log('e2e: no e2e.cmd / e2e.scopedCmd in agent-protocol.config.json')
  process.exit(2)
}
const cmd = template.replace('{report}', q(report)).replace('{filter}', filter.map(q).join(' '))
const run = sh(cmd, cfg.reportEnv ? { [cfg.reportEnv]: report } : {})
const tests = readJUnit(report)
if (!tests) {
  console.log('e2e      FAIL: the runner wrote no JUnit report')
  console.log(run.out.trim().split('\n').slice(-20).join('\n'))
  process.exit(1)
}
const count = (s) => tests.filter((t) => t.status === s).length
const [passed, failed, skipped] = [count('passed'), count('failed'), count('skipped')]
const scope = filter.length ? `   (scoped: ${filter.join(' ')})` : ''
console.log(`e2e      ${passed} passed · ${failed} failed · ${skipped} skipped · ${skipped} did not run${scope}`)
for (const t of tests.filter((x) => x.status === 'failed')) console.log(`  FAIL  ${t.id}\n        ${t.why}`)
for (const t of tests.filter((x) => x.status === 'skipped')) console.log(`  DID NOT RUN  ${t.id}`)
if (tests.length === 0) console.log(`  no test matched${scope}: nothing ran`)
process.exit(failed === 0 && skipped === 0 && tests.length > 0 ? 0 : 1)
