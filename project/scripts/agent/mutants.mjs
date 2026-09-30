#!/usr/bin/env node
// Run a batch of mutants in one call: apply, run the named test file, restore, and report killed/survived.
//
// By hand a mutant is four billed requests (edit → run → restore → check the tree), plus a dirty
// tree whenever the model forgets the restore. Here it is one request for the batch, and restoring
// is not the model's job.
//
//   node scripts/agent/mutants.mjs mutants.json
//   node scripts/agent/mutants.mjs <<'EOF'        (stdin; call node directly, npm wrappers can swallow stdin)
//   [{ "name": "M1 drop the null branch",
//      "file": "src/auth/header.ts",
//      "find": "token ? { authorization: `Bearer ${token}` } : {}",
//      "replace": "{ authorization: `Bearer ${token}` }",
//      "test": "tests/auth/header.test.ts" }]
//   EOF
//
// `find` must occur exactly once in `file`. Otherwise the mutant is ambiguous → ERROR.
// The test runs through scripts/agent/gate.mjs <test>, so "green" means the same thing as in the gate.
// Unit-level only: an e2e mutant is a hand run (break, run the module, restore), reported in the summary.
// Exit 0 = every mutant killed. Exit 1 = a mutant survived or errored.

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const file = process.argv.slice(2).find((a) => !a.startsWith('-'))
const mutants = JSON.parse(readFileSync(file ?? 0, 'utf8'))

/** Restores every file we touched, whatever happens: a signal, a crash, a bad mutant. */
const originals = new Map()
const restoreAll = () => { for (const [p, text] of originals) writeFileSync(p, text) }
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { restoreAll(); process.exit(130) })

function green(test) {
  const r = spawnSync('node', ['scripts/agent/gate.mjs', test], { encoding: 'utf8', env: process.env })
  const text = r.stdout ?? ''
  return { pass: r.status === 0, crashed: /wrote no JUnit report/.test(text), first: text.split('\n').find((l) => /FAIL /.test(l))?.trim() }
}

const lines = []
let killed = 0
let bad = 0

// A mutant against a test file that is already red proves nothing.
const baseline = new Map()
for (const t of new Set(mutants.map((m) => m.test))) baseline.set(t, green(t).pass)

try {
  for (const m of mutants) {
    const label = `${m.name ?? '(unnamed)'} · ${m.file}`
    if (!baseline.get(m.test)) {
      lines.push(`ERROR     ${label}: ${m.test} is red before mutating`)
      bad++
      continue
    }
    if (!originals.has(m.file)) originals.set(m.file, readFileSync(m.file, 'utf8'))
    const src = originals.get(m.file)
    const count = src.split(m.find).length - 1
    if (count !== 1) {
      lines.push(`ERROR     ${label}: "find" occurs ${count}× (must be exactly once)`)
      bad++
      continue
    }
    writeFileSync(m.file, src.replace(m.find, () => m.replace))
    const r = green(m.test)
    writeFileSync(m.file, src)
    if (r.pass) {
      lines.push(`SURVIVED  ${label}  (${m.test} still green)`)
      bad++
    } else {
      // A mutant that breaks compilation is killed by the compiler, not by an assertion.
      lines.push(`KILLED    ${label}${r.crashed ? '  (by a crash, not an assertion: weak)' : r.first ? `  ${r.first}` : ''}`)
      killed++
    }
  }
} finally {
  restoreAll()
}

const drift = [...originals].filter(([p, text]) => readFileSync(p, 'utf8') !== text).map(([p]) => p)
console.log(lines.join('\n'))
console.log(`MUTANTS ${killed} killed · ${bad} survived/error · files restored: ${drift.length ? `NO: ${drift.join(', ')}` : 'yes'}`)
process.exit(bad === 0 && drift.length === 0 ? 0 : 1)
