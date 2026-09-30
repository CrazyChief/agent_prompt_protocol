#!/bin/sh
# Launch a protocol agent: scripts/agent/opencode.sh coder|supervisor|qa [opencode args…]
#
# Why not plain `opencode --agent …`: your global OpenCode config may load plugins and MCP servers
# whose injected instructions push extra tool calls, and every call is a billed request.
# - A project `"plugin": []` cannot remove them: OpenCode concatenates config arrays.
# - `--pure` removes them, but also removes project plugins, including .opencode/plugins/loop-guard.ts.
# So the global config home is swapped for a lean one (.opencode/home) for this process only. Project
# config, project plugins and auth (~/.local/share/opencode) are untouched. The loop guard restores
# the real XDG_CONFIG_HOME for the agent's shell commands (git, gh, cloud CLIs).
set -e
agent="$1"
[ -n "$agent" ] || { echo "usage: scripts/agent/opencode.sh coder|supervisor|qa [opencode args…]"; exit 2; }
shift
repo="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$repo"
export AGENT_USER_XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_CONFIG_HOME="$repo/.opencode/home"
# Skill directories from other tools add noise to every system prompt.
export OPENCODE_DISABLE_EXTERNAL_SKILLS=1
# If opencode.jsonc references {env:SOME_KEY}, export only that key here, e.g.:
#   [ -n "$LOCAL_LLM_KEY" ] || LOCAL_LLM_KEY="$(sed -n 's/^LOCAL_LLM_KEY=//p' .env 2>/dev/null | head -1)"; export LOCAL_LLM_KEY
exec opencode --agent "$agent" "$@"
