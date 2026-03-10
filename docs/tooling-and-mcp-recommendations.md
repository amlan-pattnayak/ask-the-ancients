# Ask-the-Ancients Tooling and MCP Recommendations

Last updated: 2026-02-17
Scope: project-specific tooling guidance for the new `ask-the-ancients` repo

## 1) Baseline (Detected in your WSL)

Available:
- `node` `v22.22.0`
- `npm`, `npx`, `corepack`
- `bun`
- `python3` `3.12`, `pip3`, `uv`
- `git`, `gh`, `rg`, `jq`, `fzf`
- `make`, `gcc`, `g++`

Not currently available (or not usable in WSL right now):
- `pnpm` (not needed for this repo since package manager is `bun`)
- `fd`
- `sqlite3`
- `shellcheck`
- `pre-commit`
- `gitleaks`
- `git-lfs`
- `cmake`
- Docker CLI inside WSL (Windows install present, WSL integration not active)

## 2) Package Manager Decision (Frozen)

Use `bun` for this project.

Rules:
- Keep `bun.lockb` only.
- Do not commit `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`.
- Use `bun`/`bunx` in docs and scripts.

## 3) Recommended Installs (Priority Order)

## P0: Must-have for this repo

```bash
sudo apt update
sudo apt install -y fd-find sqlite3 shellcheck git-lfs cmake
python3 -m pip install --user pre-commit
mkdir -p ~/.local/bin
ln -sf "$(command -v fdfind)" ~/.local/bin/fd
```

## P1: Strongly recommended security tooling

Install `gitleaks` (binary release) and wire it into pre-commit and CI.

Why:
- Prevents accidental secret commits before private/public repo decisions.

## P2: Optional but useful

- Docker Desktop WSL integration (only if you need containerized local workflows).
- `direnv` for local env loading (do not commit `.envrc`).

## 4) Repo-Level Setup (Local to This Repo Only)

Create these files in the new repo:
- `.nvmrc` (pin Node runtime for contributors)
- `.env.example` (required env keys, no secret values)
- `.pre-commit-config.yaml` (hooks for lint + secret scan)
- Hook runner config (`lefthook` or `husky`) if desired
- Optional `.npmrc` only if you need package-manager behavior overrides

Isolation rule:
- Do not modify global shell startup files (`~/.zshrc`, `~/.bashrc`) as part of project setup.
- Keep all setup instructions repo-local and documented in `README.md`.

## 5) Project Dependencies to Add Early

Install core app/runtime:

```bash
bun add convex @clerk/nextjs ai openai zod
```

Install dev/testing/tooling:

```bash
bun add -d typescript eslint prettier @types/node vitest @playwright/test
```

Notes:
- Keep dependency additions scoped to actual use in scaffold.
- Add retrieval/eval dependencies when grounding test harness is started.

## 6) MCP Server Recommendations

## Use now

1. `context7`
- Purpose: up-to-date framework/library documentation while scaffolding.

2. `drawio` MCP (you already have `drawio-mcp-server` globally)
- Purpose: design parity checks against required `.drawio` assets:
- `chat-interface-mockup.drawio`
- `chat-interface-components.drawio`
- `philosopher-browser.drawio`
- `history-page.drawio`
- `bookmarks-page.drawio`
- `settings-page.drawio`

## Add when repo workflow matures

3. `github` MCP
- Purpose: issue/PR/project workflow from agent tools once repo is active.

4. `playwright` MCP (or equivalent browser automation MCP)
- Purpose: UI regression checks against Section 3 parity requirements.

## 7) Quick Readiness Check Command

Run this in the new project repo to validate baseline commands:

```bash
for t in bun bunx node git gh rg jq fd sqlite3 shellcheck pre-commit gitleaks; do
  printf '%-12s' "$t"
  command -v "$t" >/dev/null 2>&1 && echo OK || echo MISSING
done
```

