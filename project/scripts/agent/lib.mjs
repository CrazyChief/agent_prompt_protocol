// Shared plumbing for scripts/agent/*: config loading, shell runs, JUnit XML parsing.
// No dependencies: these scripts must run in any repo that has Node ≥ 18 and git.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export const CONFIG_PATH = 'agent-protocol.config.json'

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.log(`agent scripts: ${CONFIG_PATH} not found at the repo root. Run from the repo root.`)
    process.exit(2)
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
}

/** Run a shell command from the repo root; output captured, never streamed. */
export function sh(cmd, env = {}) {
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 256 * 1024 * 1024 })
  return { ok: r.status === 0, status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

export function git(...args) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${(r.stderr ?? '').trim()}`)
  return r.stdout.trimEnd()
}

export function tempReport(prefix) {
  return join(mkdtempSync(join(tmpdir(), `${prefix}-`)), 'junit.xml')
}

/** Shell-quote one argument for substitution into a command template. */
export const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`))
  return m ? decode(m[1]) : ''
}
const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/**
 * Parse JUnit XML (the one report format nearly every test runner can write) into test results.
 * Deliberately small: <testcase> elements, with <failure>/<error>/<skipped> children.
 * The id is "classname › name". A known-failure baseline matches on it, so it survives line moves.
 */
export function parseJUnit(xml) {
  const tests = []
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g
  let m
  while ((m = re.exec(xml))) {
    const head = `<testcase${m[1]}>`
    const body = m[3] ?? ''
    const name = attr(head, 'name')
    const classname = attr(head, 'classname') || attr(head, 'file')
    const failed = /<(failure|error)\b/.test(body)
    const skipped = /<skipped\b/.test(body)
    const why = failed ? decode((body.match(/<(?:failure|error)\b[^>]*?message="([^"]*)"/) ?? [])[1] ?? (body.match(/<(?:failure|error)\b[^>]*>([\s\S]*?)<\/(?:failure|error)>/) ?? [])[1] ?? '') : ''
    tests.push({
      id: classname ? `${classname} › ${name}` : name,
      status: failed ? 'failed' : skipped ? 'skipped' : 'passed',
      why: why.replace(/<!\[CDATA\[|\]\]>/g, '').trim().split('\n')[0].slice(0, 160),
    })
  }
  return tests
}

export function readJUnit(path) {
  if (!path || !existsSync(path)) return null
  return parseJUnit(readFileSync(path, 'utf8'))
}
