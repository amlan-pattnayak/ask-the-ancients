# Contributing to Ask the Ancients

Thanks for your interest in contributing. This document covers everything you need to get a PR merged.

---

## Before You Start

- Read the [README](README.md) and complete local setup first.
- For significant changes, open an issue before writing code so we can align on scope.
- Adding a philosopher? See [ADDING_PHILOSOPHERS.md](ADDING_PHILOSOPHERS.md) — there's a separate checklist.

---

## Development Workflow

### Branches

| Branch | Purpose |
|---|---|
| `main` | Stable, always deployable |
| `dev` | Integration branch for in-progress work |
| `feat/<short-description>` | New features |
| `fix/<short-description>` | Bug fixes |
| `docs/<short-description>` | Documentation-only changes |
| `chore/<short-description>` | Tooling, deps, CI changes |

Branch from `dev` for features and fixes. Branch from `main` for hotfixes.

### Workflow

```bash
git checkout dev
git pull
git checkout -b feat/your-feature-name

# ... make changes ...

bun typecheck   # must pass
bun lint        # must pass
bun test        # must pass

git push -u origin feat/your-feature-name
# Open a PR targeting dev
```

---

## Pull Requests

- **Title format:** `type(scope): short description` — e.g., `feat(rag): add keyword fallback to retrieval`
- **Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`
- **Scope:** optional, refers to the subsystem — `rag`, `chat`, `auth`, `ingest`, `ui`, `ci`
- Keep PRs focused. One logical change per PR.
- Include a brief description of what changed and why.
- Reference the relevant issue number if applicable: `Closes #42`

### PR checklist

- [ ] `bun typecheck` passes
- [ ] `bun lint` passes
- [ ] `bun test` passes
- [ ] No secrets or real API keys added (CI runs gitleaks)
- [ ] UI changes match the draw.io design assets in `assets/`
- [ ] New env vars documented in `.env.local.example` and `README.md`

---

## Commit Message Convention

```
type(scope): short imperative summary (≤72 chars)

Optional body explaining what and why, not how.
Wrap at 72 chars.

Optional footer: Closes #42, Breaking Change: ...
```

Examples:

```
feat(rag): use RRF to blend vector and keyword results
fix(auth): handle missing anonId on first load
docs: add philosopher request issue template
chore(ci): upgrade gitleaks to v2.19
```

---

## Running Tests

```bash
bun test              # run all unit tests once
bun test:watch        # watch mode
bun test src/lib/__tests__/citations.test.ts  # single file
```

Tests live in `src/lib/__tests__/`. We use [Vitest](https://vitest.dev) with the default `bun` runner.

---

## Linting

```bash
bun lint
```

ESLint is configured via `eslint.config.mjs` using the Next.js preset. Fix issues before opening a PR — CI will catch them regardless.

---

## Code Style

- TypeScript strict mode is on — avoid `any` where possible.
- Use `bun`/`bunx` in all scripts, never `npm`, `pnpm`, or `yarn`.
- Convex mutations/queries/actions must be typed using the generated types in `convex/_generated/`.
- All user-owned tables must use `principalType` + `principalId`, never `userId` alone. This is a frozen architectural decision (D1 in CLAUDE.md).
- Never log or surface API keys in error messages or traces.

---

## Reporting Issues

Use the issue templates in `.github/ISSUE_TEMPLATE/`:
- Bug reports
- Feature requests
- Philosopher addition requests

---

## Good First Issues

- Agora comparison mode MVP: add a structured two-philosopher response format with shared citation rendering.
- Library view groundwork: build a browse/search page for `sourceTexts` with work/chapter filtering.
- Retrieval quality baseline: add repeatable eval cases to `scripts/eval-harness.ts` (retrieval relevance + citation faithfulness).
- Persona isolation checks: add tests that detect cross-philosopher style bleed in prompt assembly.
- Citation UX polish: improve desktop rail/mobile accordion parity and add keyboard accessibility coverage.
