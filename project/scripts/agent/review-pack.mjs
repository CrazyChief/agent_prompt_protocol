#!/usr/bin/env node
// Everything a reviewer needs about a branch, in one call.
//
// Agents are billed per request. In the source project, 21 % of supervisor tool calls were
// `git log/diff/show/status` and another 17 % gate/test runs, one command per request. This prints
// them all at once, plus the mechanical hard-rule checks from agent-protocol.config.json, so the
// model's requests go to judgement instead of plumbing.
//
//   node scripts/agent/review-pack.mjs <merge-base>            facts, rule checks, e2e leads, gate, diff
//   node scripts/agent/review-pack.mjs <merge-base> --short    facts + gate (the coder's summary header)
//   node scripts/agent/review-pack.mjs <merge-base> --no-gate  skip the gate
//
// Read-only: it never checks out, stashes or edits anything.

import { spawnSync } from 'node:child_process'
import { git, loadConfig } from './lib.mjs'

const cfg = loadConfig()
const rp = cfg.reviewPack ?? {}
const args = process.argv.slice(2)
const base = args.find((a) => !a.startsWith('-'))
const short = args.includes('--short')
const noGate = args.includes('--no-gate')
const DIFF_CAP = rp.diffCap ?? 4000

if (!base) {
  console.log('usage: node scripts/agent/review-pack.mjs <merge-base> [--short] [--no-gate]')
  process.exit(2)
}
try {
  git('rev-parse', '--verify', `${base}^{commit}`)
} catch {
  console.log(`review-pack: unknown commit "${base}"`)
  process.exit(2)
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const range = `${base}..HEAD`
const shortRange = `${git('rev-parse', '--short', base)}..HEAD`
const out = []
const section = (t) => out.push('', `## ${t}`)

out.push(`# REVIEW PACK  branch ${branch} · head ${git('rev-parse', '--short', 'HEAD')} · merge-base ${git('rev-parse', '--short', base)}`)
const dirty = git('status', '--porcelain', '--untracked-files=no')
out.push(dirty ? `tree: DIRTY: uncommitted changes are not part of the delivery:\n${dirty}` : 'tree: clean')

section('Commits (oldest first)')
out.push(git('log', '--reverse', '--format=%h %s', range) || '(none)')
section('Files changed')
out.push(git('diff', '--stat=120', range) || '(none)')

if (!short) {
  section('Hard-rule checks (mechanical: a hit is a lead, not a verdict)')
  const status = git('diff', '--name-status', range).split('\n').filter(Boolean)
  const path = (l) => l.split('\t').pop()
  // Added lines only: a rule is about what this branch introduces, not what it deletes.
  const added = git('diff', '-U0', range).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
  const check = (label, list) =>
    out.push(`${list.length ? 'CHECK' : 'ok   '} ${label}${list.length ? `\n${list.map((x) => `    ${x.slice(0, 160)}`).join('\n')}` : ''}`)

  const main = cfg.mainBranch ?? 'main'
  check(`H1 branch is not ${main}`, branch === main ? [`on ${branch}`] : [])
  for (const rule of rp.ruleChecks ?? []) {
    const label = `${rule.id} ${rule.label}`
    if (rule.addedLineRegex) {
      const re = new RegExp(rule.addedLineRegex, 'i')
      check(label, added.filter((l) => re.test(l)))
    } else if (rule.changedPathRegex) {
      const re = new RegExp(rule.changedPathRegex)
      check(label, status.filter((l) => re.test(path(l)) && !(rule.ignoreAdded && l.startsWith('A'))))
    } else if (rule.shrunkPathRegex) {
      const re = new RegExp(rule.shrunkPathRegex)
      check(
        label,
        status.filter((l) => re.test(path(l))).filter((l) => {
          if (l.startsWith('D')) return true
          const removed = Number(git('diff', '--numstat', range, '--', path(l)).split('\t')[1])
          return removed > 0
        }),
      )
    }
  }

  const routes = rp.routes
  if (routes?.pageRegex) {
    section('e2e specs that name a route this branch adds, removes or edits')
    // The unit gate does not run e2e specs, so a page change can break another task's spec
    // invisibly. A grep is only a lead; the done condition for a route change is a full e2e run.
    const pageRe = new RegExp(routes.pageRegex)
    const changed = status.map(path).filter((f) => pageRe.test(f))
    const toRoute = (f) =>
      f.replace(routes.stripPrefix ?? '', '').replace(/\.[a-z]+$/, '').replace(/\/index$/, '').replace(/\/[[(].*$/, '') || '/'
    const list = [...new Set(changed.map(toRoute))]
    if (!list.length) out.push('(no page files changed)')
    for (const r of list) {
      if (r === '/') {
        out.push('/  →  root page: every spec visits it; run the full e2e suite')
        continue
      }
      const g = spawnSync('grep', ['-rlE', `["'\`]${r}(["'\`/?#]|$)`, routes.e2eDir ?? 'tests/e2e'], { encoding: 'utf8' })
      out.push(`${r}  →  ${g.stdout.trim().split('\n').filter(Boolean).join(', ') || 'no spec names it'}`)
    }
  }
}

if (!noGate) {
  section('Gate (checks + unit suite vs known failures)')
  const g = spawnSync('node', ['scripts/agent/gate.mjs'], { encoding: 'utf8', env: process.env })
  out.push(`${g.stdout ?? ''}${g.stderr ?? ''}`.trim())
}

if (!short) {
  section(`Diff ${shortRange} (lockfiles excluded)`)
  const excludes = (rp.diffExclude ?? []).map((p) => `:(exclude)${p}`)
  const diff = git('diff', range, '--', '.', ...excludes).split('\n')
  out.push(diff.slice(0, DIFF_CAP).join('\n'))
  if (diff.length > DIFF_CAP) {
    out.push(`… diff truncated at ${DIFF_CAP} of ${diff.length} lines. Read the remaining files from "Files changed" in ONE batched read.`)
  }
}

console.log(out.join('\n'))
