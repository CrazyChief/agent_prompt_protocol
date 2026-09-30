#!/usr/bin/env node
// One command, one verdict, a handful of lines.
//
// Agents used to run typecheck, lint and tests separately and paste the full test output into their
// context on every check. This runs them all in one call, prints only what changes a decision, and
// answers the regression question mechanically: failures are compared against a recorded baseline
// of known failures, so only NEW ones are named.
//
//   node scripts/agent/gate.mjs                 every check + the full suite vs known failures
//   node scripts/agent/gate.mjs <test file…>    those test files only (RED/GREEN, a mutant)
//   node scripts/agent/gate.mjs --record        operator only: rewrite the known-failures baseline
//
// Commands come from agent-protocol.config.json → gate. Exit 0 = nothing new is broken.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { loadConfig, sh, tempReport, readJUnit, q } from './lib.mjs'

const cfg = loadConfig().gate ?? {}
const pattern = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const scoped = pattern.length > 0
const KNOWN = cfg.knownFailures ?? 'tests/known-failures.json'

const lines = []
let ok = true

if (!scoped) {
  const results = (cfg.checks ?? []).map((c) => ({ ...c, ...sh(c.cmd) }))
  if (results.length) lines.push(results.map((r) => `${r.name} ${r.ok ? 'ok' : 'FAIL'}`).join('   '))
  // Only a failing stage earns its output.
  for (const r of results.filter((x) => !x.ok)) lines.push(r.out.trim().split('\n').slice(-25).join('\n'))
  ok = results.every((r) => r.ok)
}

const report = tempReport('gate')
const template = scoped ? cfg.test?.scopedCmd : cfg.test?.cmd
if (!template) {
  console.log('gate: no gate.test command in agent-protocol.config.json')
  process.exit(2)
}
const run = sh(template.replace('{report}', q(report)).replace('{pattern}', pattern.map(q).join(' ')))
const tests = readJUnit(report)
if (!tests) {
  console.log('test      FAIL: the test runner wrote no JUnit report (it crashed before running, or the command is wrong)')
  console.log(run.out.trim().split('\n').slice(-15).join('\n'))
  console.log('GATE fail')
  process.exit(1)
}

const failed = tests.filter((t) => t.status === 'failed')
const passed = tests.filter((t) => t.status === 'passed').length
const skipped = tests.filter((t) => t.status === 'skipped').length
const known = existsSync(KNOWN) ? JSON.parse(readFileSync(KNOWN, 'utf8')).known ?? [] : []
const fresh = failed.filter((f) => !known.includes(f.id))

if (scoped) {
  lines.push(`test      ${passed} pass · ${skipped} skipped · ${failed.length} fail   (${pattern.join(' ')})`)
  for (const f of failed) lines.push(`  FAIL  ${f.id}\n        ${f.why}`)
  if (tests.length === 0) lines.push('  no test matched: a scoped run that runs nothing proves nothing')
  ok = ok && failed.length === 0 && tests.length > 0
} else {
  lines.push(`test      ${passed} pass · ${skipped} skipped · ${failed.length - fresh.length} known · ${fresh.length} NEW`)
  for (const f of fresh) lines.push(`  NEW   ${f.id}\n        ${f.why}`)
  ok = ok && fresh.length === 0
}

console.log(lines.join('\n'))
console.log(ok ? 'GATE ok' : 'GATE fail')

// Deliberately manual: an agent that could silence a regression by re-recording it would defeat the
// check. This flag is the operator's and never appears in an agent's instructions.
if (process.argv.includes('--record') && !scoped) {
  writeFileSync(KNOWN, `${JSON.stringify({ known: failed.map((f) => f.id) }, null, 2)}\n`)
  console.log(`recorded ${failed.length} known failures → ${KNOWN}`)
}

process.exit(ok ? 0 : 1)
