# Ask-the-Ancients M0 Architecture Freeze Notes (Scaffolding Ready)

Last updated: 2026-02-17
Status: frozen for scaffolding kickoff

## Purpose

This document defines non-negotiable M0 decisions so a coding agent can scaffold the project without rework.

Primary references:
- `01_projects/ask-the-ancients/drafts/open-source-philosopher-chat-project-plan.md`
- `01_projects/ask-the-ancients/drafts/open-source-philosopher-chat-mvp-execution-spec.md`

## Freeze Decisions

## D1) Principal and Identity Model (No Sign-In Wall + Optional Auth)

Decision:
- System supports two principal types from day one:
- `anonId` (default, required for anonymous users)
- `userId` (optional, populated when signed in with Clerk)

Rules:
- No core table may require `userId` for basic app functionality.
- Anonymous users must be able to:
- create threads
- receive responses
- view history
- save bookmarks
- consume daily guest allowance
- On sign-in, data is merged from `anonId` to `userId` via idempotent merge operation.
- If merge fails partially, retry must be safe and must not duplicate rows.

Scaffolding contract:
- Add a `principalType` enum (`anon` | `user`) and `principalId` string on user-owned records.
- Keep optional convenience indexes for `userId` if needed, but do not use as sole ownership key.
- Add a `principal_aliases`/mapping table for merge lineage if required.

## D2) BYOK Security and Storage Defaults

Decision:
- BYOK is supported in two explicit modes:
- `session` mode (default): key in memory/session scope only, cleared on browser close/tab reset.
- `persistent` mode (opt-in): encrypted client-side at rest with explicit warning.

Rules:
- Default must be `session` mode.
- UI must clearly indicate key handling policy.
- No BYOK secret values in logs, telemetry, or error traces.
- Do not commit any server behavior that stores raw BYOK keys by default.
- If a proxy is used, it must be secret-safe and non-logging for sensitive headers.

Scaffolding contract:
- Create provider settings model with:
- `provider`
- `mode` (`guest` | `byok`)
- `keyStorageMode` (`session` | `persistent`)
- `model`
- `customEndpoint` (optional)
- Create placeholder secret redaction utility and wire it into logging layer at scaffold stage.

## D3) Guest Inference Path (Single Provider for V1 Start)

Decision:
- First guest provider path is `Groq` (single guest path in V1 start).
- Guest path remains limited and rate-controlled.

Rules:
- Guest inference has server-side rate limiting from day one.
- Minimum policy:
- anonymous: 10 messages/day
- signed-in free user: 15 messages/day
- Keep provider abstraction shape in code, but only one guest provider is active at scaffold stage.
- Include operator kill switch flag for guest mode in config.

Scaffolding contract:
- Add config flags:
- `GUEST_MODE_ENABLED` (bool)
- `GUEST_PROVIDER=groq`
- `GUEST_DAILY_LIMIT_ANON=10`
- `GUEST_DAILY_LIMIT_USER=15`
- Stub budget alert hooks and hard-stop behavior interfaces (implementation can follow in M2).

## D4) Scope and UI Adherence

Decision:
- V1 scope remains Stoics only for implementation start.
- Product vision remains unchanged.
- UI implementation must adhere 100% to Section 3 and preserved assets.

Required UI source assets:
- `01_projects/ask-the-ancients/assets/chat-interface-mockup.drawio`
- `01_projects/ask-the-ancients/assets/chat-interface-components.drawio`
- `01_projects/ask-the-ancients/assets/philosopher-browser.drawio`
- `01_projects/ask-the-ancients/assets/history-page.drawio`
- `01_projects/ask-the-ancients/assets/bookmarks-page.drawio`
- `01_projects/ask-the-ancients/assets/settings-page.drawio`

Rules:
- Any visual deviation requires explicit owner approval.

## D5) OSS Visibility Timing

Decision:
- Repository private/public switch is owner decision, not an automatic milestone action.

Rule:
- Do not include automation or workflow assumptions that force visibility change.

## D6) Package Manager and Tooling Isolation

Decision:
- Package manager for this project is `bun`.
- Scaffolding and scripts should use `bun`/`bunx`, not `pnpm`/`yarn`/`npm` as primary commands.

Rules:
- Use a single lockfile strategy (`bun.lockb` only).
- Do not commit additional lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`).
- Keep Node runtime pinning repo-local (for example `.nvmrc` in repo root); do not mutate global shell defaults.

Repo-local configuration caveat (must hold):
- Any repo-level setup (`.nvmrc`, `.npmrc`, `.env.example`, pre-commit config, hook config) must remain local to this repo.
- No global WSL config edits are allowed as part of project scaffolding.
- No shell startup file edits (`~/.zshrc`, `~/.bashrc`) are allowed for project setup.
- If a tool requires global installation, document it in `README` instead of modifying global defaults automatically.

## Scaffolding Deliverables Required From Coding Agent

1. Next.js + TypeScript + Tailwind app scaffold with `src/` layout.
2. Convex scaffold with initial schema reflecting principal model (`principalType`, `principalId`).
3. Clerk wiring as optional auth (no sign-in wall).
4. Route skeletons for:
- `/`
- `/philosophers`
- `/philosophers/[slug]`
- `/chat/[threadId]`
- `/history`
- `/bookmarks`
- `/settings`
5. Component skeletons aligned to Section 3 page architecture.
6. Provider abstraction interfaces with:
- guest mode (`groq`) path active
- BYOK path interfaces present
7. Rate-limit service interface and config placeholders.
8. Env template with required non-secret keys only.
9. Basic CI scaffold:
- typecheck
- lint
- secret scan placeholder step
10. Tooling scripts and docs use `bun` command surface consistently.

## Done Criteria for Scaffolding Phase

- Project boots locally and renders all route skeletons.
- Convex schema deploys successfully.
- Anonymous principal flow can create a thread record.
- Optional sign-in can resolve `userId` without blocking anonymous usage.
- Settings page can toggle guest/BYOK mode at UI state level.
- No hardcoded secrets in code or sample env.

## Handoff Snippet (for coding agent prompt)

Use `01_projects/ask-the-ancients/drafts/m0-architecture-freeze-notes-for-scaffolding.md` as binding constraints. Implement scaffold only. Do not build full features. Preserve no-sign-in-wall UX, principal model (`anonId` + optional `userId`), BYOK default session mode, guest provider path (`Groq`), and Section 3 UI parity structure. Do not decide repository visibility timing.
