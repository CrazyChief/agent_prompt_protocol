#!/usr/bin/env node
// QA preflight in one call: right commit, clean tree, environment up, and what the app runs with.
//
// In the source project the first ~70 requests of a QA run went to finding these facts one command
// at a time (git status, curl, lsof, ps, grepping .env). This prints them together.
//
//   node scripts/agent/qa-preflight.mjs <branch> <commit>
//
// Prints PREFLIGHT READY or PREFLIGHT STOP. Secret-shaped env values are masked.
// Read-only: it does not check out, start or restart anything.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { sh, loadConfig } from './lib.mjs'

const cfg = loadConfig().qa ?? {}
const [branch, commit] = process.argv.slice(2).filter((a) => !a.startsWith('-'))
if (!branch || !commit) {
  console.log('usage: node scripts/agent/qa-preflight.mjs <branch> <commit>')
  process.exit(2)
}
const problems = []
const out = []

const onBranch = sh('git rev-parse --abbrev-ref HEAD').out.trim()
const head = sh('git rev-parse HEAD').out.trim()
out.push(`branch   ${onBranch}${onBranch === branch ? '' : `   STOP: expected ${branch}`}`)
out.push(`head     ${head.slice(0, 7)}${head.startsWith(commit) ? '' : `   STOP: expected ${commit}`}`)
if (onBranch !== branch || !head.startsWith(commit)) problems.push('wrong branch or commit')

const dirty = sh('git status --porcelain').out.trim()
out.push(`tree     ${dirty ? `STOP: not clean:\n${dirty}` : 'clean'}`)
if (dirty) problems.push('dirty tree')

// One probe implementation: the e2e runner's.
const probe = sh('node scripts/agent/e2e.mjs --probe')
out.push(probe.out.trim())
if (!probe.ok) problems.push('environment')

// An env file edited after the dev server started is not live until a restart: a trap recipes keep hitting.
const envFile = cfg.envFile ?? '.env'
const port = new URL(cfg.baseUrl ?? 'http://localhost:3000').port || '80'
const pid = sh(`lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null`).out.split('\n')[0].trim()
if (pid) {
  const started = new Date(sh(`ps -o lstart= -p ${pid}`).out.trim())
  const stale = existsSync(envFile) && !Number.isNaN(started.getTime()) && statSync(envFile).mtime > started
  out.push(`app      pid ${pid} on :${port}${Number.isNaN(started.getTime()) ? '' : `, started ${started.toISOString()}`}${stale ? `   NOTE: ${envFile} changed after start; restart before testing` : ''}`)
}

if (existsSync(envFile)) {
  const secret = /KEY|SECRET|TOKEN|PASSWORD|PASS\b|PRIVATE/i
  const env = readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((l) => /^[A-Za-z0-9_]+=/.test(l))
    .map((l) => {
      const [k, ...v] = l.split('=')
      return `  ${k}=${secret.test(k) ? '•••' : v.join('=').replace(/\/\/[^@/\s]+@/, '//•••@')}`
    })
  out.push(`${envFile} (secret-shaped values masked):`, ...env)
}

console.log(out.join('\n'))
console.log(problems.length ? `PREFLIGHT STOP: ${problems.join(', ')}` : 'PREFLIGHT READY')
process.exit(problems.length ? 1 : 0)
