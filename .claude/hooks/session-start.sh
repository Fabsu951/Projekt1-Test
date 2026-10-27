#!/bin/bash
# Installs Python dependencies so the notebook, linter and smoke test work in Claude Code cloud sessions.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
python3 -m pip install --quiet --disable-pip-version-check -r requirements.txt
python3 -m ipykernel install --user --name python3 >/dev/null
