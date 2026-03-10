# Ask-the-Ancients MVP Execution Spec

Last updated: 2026-02-17
Status: execution contract for OSS V1

## 1) Scope Lock (What ships in OSS V1)

- Traditions and personas: Stoics only (`Marcus Aurelius`, `Seneca`, `Epictetus`)
- Product surfaces: landing, philosopher selector, chat, history, bookmarks, settings
- Core value promise: grounded responses with citations to source passages
- Product vision from `open-source-philosopher-chat-project-plan.md` is preserved as-is
- Identity: no sign-in wall; anonymous users supported from first request
- Auth option: optional Clerk sign-in for sync and higher limits
- Inference modes:
- `BYOK` as primary path
- One guest mode provider path for limited free usage
- Public release timing: repository visibility decision is owner-controlled

Out of scope for V1:
- Indian schools integration
- multi-provider explosion beyond one stable BYOK path plus one guest path
- push notifications, debates, community sharing, voice mode

UI/UX adherence rule:
- UI/UX implementation must adhere 100% to Section 3 design in `open-source-philosopher-chat-project-plan.md`
- Existing design assets under `01_projects/ask-the-ancients/assets/` are mandatory source artifacts
- Required assets to preserve and use:
- `01_projects/ask-the-ancients/assets/chat-interface-mockup.drawio`
- `01_projects/ask-the-ancients/assets/chat-interface-components.drawio`
- `01_projects/ask-the-ancients/assets/philosopher-browser.drawio`
- `01_projects/ask-the-ancients/assets/history-page.drawio`
- `01_projects/ask-the-ancients/assets/bookmarks-page.drawio`
- `01_projects/ask-the-ancients/assets/settings-page.drawio`
- Any visual deviation requires explicit owner approval

## 2) MVP Acceptance Criteria

Each criterion is release-blocking unless marked "post-launch hardening".

### A. Product and UX

- User can start chat with any of the 3 Stoics in under 2 taps from landing.
- Streaming response works on modern mobile and desktop browsers.
- Every assistant response includes 1-3 citations when retrieval succeeds.
- Citation card opens source context with text snippet and source reference.
- History page shows previous threads for current principal (anonymous or signed-in).
- Bookmarks can be added/removed and revisited in thread context.
- Settings page exposes inference mode, rate-limit status, and data controls.
- All Section 3 page layouts, navigation behavior, and key interaction patterns are implemented without simplification.
- Design asset parity checks are completed for chat, browser, history, bookmarks, and settings before launch.

### B. Grounding and Quality

- Retrieved passages are filtered by selected philosopher.
- Assistant cannot emit citation references not present in retrieved context.
- Automated eval suite exists and runs in CI for:
- retrieval relevance sanity checks (small gold set)
- citation faithfulness checks (reference must map to retrieved chunk)
- hallucinated quote rejection checks
- Minimum quality threshold for release:
- citation faithfulness >= 95% on eval set
- hallucinated references = 0 on eval set

### C. Identity and Data Model

- System supports both `anonId` and `userId`.
- Anonymous data model supports threads, bookmarks, and usage accounting.
- On sign-in, merge flow exists from `anonId` to `userId` with idempotent behavior.
- No table requires Clerk user ID for basic V1 operation.

### D. Security and Privacy

- BYOK storage mode explicitly user-selectable:
- session-only (default, in-memory)
- persistent (encrypted at rest client-side with clear warning)
- No secrets logged in app/server logs.
- CSP and basic XSS hardening enabled before release.
- Secret scanning configured pre-public (`gitleaks` or equivalent).

### E. Abuse, Reliability, and Cost Controls

- Rate limits enforced server-side for anonymous and signed-in users.
- Abuse controls include at minimum:
- signed device identifier
- IP/ASN velocity checks
- challenge escalation (Turnstile or equivalent)
- Guest mode has an operator kill switch.
- Budget guardrails with hard stop behavior and operator alerting.
- Fallback behavior for provider outage is user-visible and non-destructive.

### F. OSS Readiness

- `README.md` includes architecture, local setup, and quick start.
- `CONTRIBUTING.md` and issue templates are present.
- `ADDING_PHILOSOPHERS.md` defines contribution format and quality bar.
- `.env.local.example` is complete and does not contain real values.
- License and attribution file for all text sources/translations are included.

## 3) Risk Register

Severity key: `H` high, `M` medium, `L` low.

| ID | Risk | Severity | Impact | Mitigation | Trigger | Owner |
|---|---|---|---|---|---|---|
| R1 | Identity mismatch (`no-login` UX vs `userId`-only schema) | H | Broken anonymous flows, rework | Add `anonId` principal model and merge contract before feature work | Any schema PR requiring `userId` | Backend |
| R2 | BYOK key leakage via `localStorage`/XSS | H | Credential compromise, trust loss | Default session-only key mode, CSP, no inline unsafe scripts, persistence opt-in warning | Any BYOK persistence code | Full-stack |
| R3 | Citation hallucination despite RAG | H | Core product trust broken | CI eval harness, citation validator, strict response post-check | Eval fail on faithfulness | AI/Backend |
| R4 | Source/license ambiguity for translations | H | Legal/compliance risk | Maintain source license matrix + attribution manifest before ingestion | New text source added | Content |
| R5 | Free-tier pricing/limits shift | M | Unexpected costs or outages | Budget caps, kill switch, no-free-tier fallback assumptions in runbook | Provider policy change | Ops |
| R6 | Abuse evasion of simple device+IP limit | M | Cost blowout, degraded UX | Multi-signal rate limiting + challenge escalation + anomaly alerts | Spike in anonymous traffic | Backend/Ops |
| R7 | Over-scoped roadmap delays first OSS release | M | Lost momentum, no shipped artifact | Freeze V1 scope; move Indian schools to V2 milestone | >2 weeks without releasable increment | Product |
| R8 | Convex/Clerk/Vercel quota assumptions drift | M | Runtime failures under growth | Monthly limit review and load tests against expected DAU | 60% quota usage | Ops |
| R9 | Retrieval quality degrades with corpus changes | M | Worse answer quality | Versioned chunking pipeline, regression eval set | Eval regression >5% | AI |
| R10 | Missing observability for incidents | L | Slow recovery | Structured logs + error dashboards + smoke scripts | First prod incident | Ops |

## 4) Milestones and Checklist

Milestones are sequential release gates. Do not skip gates.

## M0 - Architecture Freeze

- [ ] Finalize principal model (`anonId`, optional `userId`, merge semantics)
- [ ] Finalize inference modes (one BYOK path + one guest provider path)
- [ ] Finalize source licensing matrix template
- [ ] Define CI checks (typecheck, lint, eval harness, secret scan)

Exit criteria:
- [ ] Architecture notes approved and linked in repo docs
- [ ] No open high-severity design risks without owner

## M1 - Vertical Slice (Private Repo)

- [ ] One Stoic end-to-end chat works with citations
- [ ] Retrieval constrained to philosopher corpus
- [ ] History and bookmarks functional for anonymous principal
- [ ] Basic settings with rate-limit visibility
- [ ] Smoke tests for chat, retrieval, citation rendering
- [ ] UI parity pass against Section 3 + draw.io assets for implemented pages

Exit criteria:
- [ ] Demoable flow from landing -> ask -> cited answer -> bookmark
- [ ] No critical runtime errors in local + preview deploy
- [ ] No unapproved UI deviations for implemented pages

## M2 - Quality and Safety Gate

- [ ] Add remaining two Stoics
- [ ] Add CI eval harness for grounding/citations
- [ ] Implement server-side rate limiting and abuse controls
- [ ] Implement BYOK security model and secret-safe logging
- [ ] Implement budget alerts + guest kill switch

Exit criteria:
- [ ] Citation faithfulness threshold met
- [ ] Abuse simulation test passed
- [ ] Budget guardrails verified in test mode

## M3 - OSS Packaging Gate

- [ ] README, CONTRIBUTING, ADDING_PHILOSOPHERS, ARCHITECTURE complete
- [ ] Attribution and license manifest complete for all included texts
- [ ] `.env.local.example` verified
- [ ] `gitleaks` scan clean
- [ ] GitHub issue templates and CI workflow active

Exit criteria:
- [ ] New contributor can run locally in <= 10 minutes using docs
- [ ] Repo passes CI on clean clone

## M4 - Public Launch

- [ ] Vercel + Convex production deploy stable
- [ ] Manual smoke across iOS Safari, Android Chrome, desktop
- [ ] Repository visibility decision confirmed by owner
- [ ] Launch assets prepared (demo clip + screenshots)

Exit criteria:
- [ ] Public URL stable for 72 hours
- [ ] No open critical issues at launch

## 5) Post-Launch Backlog Order (V1.1 -> V2)

1. Provider abstraction expansion (after instrumentation confirms demand)
2. Better retrieval eval coverage and contributor test fixtures
3. Indian schools integration with licensing-first workflow
4. Stretch features (debates, voice, daily digest, community sharing)
