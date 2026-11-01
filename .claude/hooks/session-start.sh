#!/bin/bash
# Claude Code cloud sessions: install the tools from .mise/config.toml (Node, prek), the npm
# dependencies and the prek Git hooks, so commits there get the same checks as locally.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Anything on stdout would be added to Claude's context.
exec >&2

cd "${CLAUDE_PROJECT_DIR:-.}"
export MISE_YES=1

command -v mise >/dev/null || npm install --global --no-fund --no-audit @jdxcode/mise
mise install
mise reshim
shims="${MISE_DATA_DIR:-$HOME/.local/share/mise}/shims"
export PATH="$shims:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$shims:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

# Run npm install only if something that decides what gets installed changed since it last succeeded.
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  npm install --no-fund --no-audit
  sha256sum .claude/hooks/session-start.sh .mise/config.toml package.json package-lock.json > "$hashes" || rm -f "$hashes"
fi

prek install
