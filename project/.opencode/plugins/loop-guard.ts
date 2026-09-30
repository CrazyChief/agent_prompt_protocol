// Loop guard: stops an agent that repeats itself. Every repeat is a billed request.
//
// Measured in the source project: one model wasted 670 requests on runs of the
// SAME tool call with the SAME arguments (297× one psql command, 181× one grep, …). OpenCode's own
// `doom_loop` guard did not fire. It only compares tool calls inside ONE assistant message, and these models make one call per
// request, so every repeat lands in a new message.
//
// So the comparison here runs across the whole session:
//   2nd identical call in a row → it runs, and its output gets a warning appended
//   3rd                         → blocked: the tool is not executed, the model receives the error below
//   5th                         → the session is aborted: the human decides what happens next
// Any different call resets the count, so legitimate re-runs (edit → test → edit → test) are never
// affected: the edits differ, so no two calls in a row are the same.
//
// Pure-text loops (the same reply over and over, no tool calls) get a system-prompt warning on the
// next request, and an abort at the 4th.
//
// Deliberately dependency-free (types only): no package install is needed in .opencode/.

import type { Plugin } from '@opencode-ai/plugin'

const WARN_AT = 2
const BLOCK_AT = 3
const ABORT_AT = 5
const TEXT_ABORT_AT = 4

/** Key-order-independent JSON, so `{a,b}` and `{b,a}` count as the same call. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function preview(tool: string, args: unknown): string {
  const s = `${tool} ${stable(args)}`
  return s.length > 160 ? `${s.slice(0, 160)}…` : s
}

export const LoopGuard: Plugin = async ({ client }) => {
  const lastCall = new Map<string, { sig: string; count: number }>()
  const pendingWarning = new Map<string, string>()
  const textRepeats = new Map<string, number>()

  const abort = async (sessionID: string, why: string) => {
    await client.app
      .log({ body: { service: 'loop-guard', level: 'warn', message: `abort ${sessionID}: ${why}` } })
      .catch(() => {})
    await client.session.abort({ path: { id: sessionID } }).catch(() => {})
  }

  return {
    // scripts/agent/opencode.sh swaps XDG_CONFIG_HOME to a lean OpenCode config home. The agent's shell
    // commands (git, gh, cloud CLIs…) must still see the user's real one.
    'shell.env': async (_input, { env }) => {
      const real = process.env.AGENT_USER_XDG_CONFIG_HOME
      if (real) env.XDG_CONFIG_HOME = real
    },

    'tool.execute.before': async ({ tool, sessionID, callID }, { args }) => {
      // `description` and `timeout` are cosmetic: rewording the description must not hide a loop.
      const essential = Object.fromEntries(
        Object.entries((args ?? {}) as Record<string, unknown>).filter(([k]) => k !== 'description' && k !== 'timeout'),
      )
      const sig = `${tool}\u0000${stable(essential)}`
      const prev = lastCall.get(sessionID)
      const count = prev?.sig === sig ? prev.count + 1 : 1
      lastCall.set(sessionID, { sig, count })
      const what = preview(tool, args)

      if (count >= ABORT_AT) {
        await abort(sessionID, `${count}× identical ${what}`)
        throw new Error(
          `LOOP GUARD — session stopped: this is identical call #${count} in a row (${what}). ` +
            'Stop, and report what you were trying to do and why it did not work.',
        )
      }
      if (count >= BLOCK_AT) {
        throw new Error(
          `LOOP GUARD — blocked, not executed: identical call #${count} in a row (${what}). ` +
            'The result cannot change. You are in a loop: take a DIFFERENT step. Change the command, ' +
            'read the error you already have, or stop and report. ' +
            `At #${ABORT_AT} the session is stopped.`,
        )
      }
      if (count === WARN_AT) {
        pendingWarning.set(
          callID,
          `LOOP GUARD — this was the 2nd identical call in a row (${what}), so the result above is the ` +
            'same as the last one. Do not repeat it: use the result, change the approach, or stop and ' +
            `report. A 3rd identical call will be blocked.`,
        )
      }
    },

    'tool.execute.after': async ({ callID }, output) => {
      const warning = pendingWarning.get(callID)
      if (!warning) return
      pendingWarning.delete(callID)
      output.output = `${output.output ?? ''}\n\n${warning}`
    },

    // Pure-text repeats: the last two assistant messages with no tool call carry the same text.
    'experimental.chat.messages.transform': async (_input, { messages }) => {
      const replies = messages.filter((m) => m.info.role === 'assistant')
      if (replies.length < 2) return
      const sessionID = replies[replies.length - 1].info.sessionID
      const textOf = (m: (typeof replies)[number]) =>
        m.parts.some((p) => p.type === 'tool')
          ? null
          : m.parts
              .filter((p) => p.type === 'text')
              .map((p) => ('text' in p ? p.text : ''))
              .join('\n')
              .trim() || null
      let run = 1
      const last = textOf(replies[replies.length - 1])
      for (let i = replies.length - 2; last && i >= 0 && textOf(replies[i]) === last; i--) run++
      if (run < 2) {
        textRepeats.delete(sessionID)
        return
      }
      textRepeats.set(sessionID, run)
      if (run >= TEXT_ABORT_AT) await abort(sessionID, `${run}× identical reply`)
    },

    'experimental.chat.system.transform': async ({ sessionID }, { system }) => {
      const run = sessionID ? textRepeats.get(sessionID) : undefined
      if (!run) return
      system.push(
        `LOOP GUARD — your last ${run} replies were identical. Repeating it again changes nothing. ` +
          'Take a different step, or state plainly what is blocking you and stop.',
      )
    },
  }
}
