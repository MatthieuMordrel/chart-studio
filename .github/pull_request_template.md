## Areas touched
<!-- Tick all that apply with [x]. Keep every option, ticked or not. If none applies, leave them all empty and say why on a line below the list. -->
- [ ] UI
- [ ] API
- [ ] Database / migration
- [ ] Config (env vars, feature flags, tool settings)
- [ ] Infra / deploy
- [ ] CI
- [ ] Tests / linting
- [ ] Dependencies
- [ ] Documentation

## Type of change
<!-- Tick one with [x]. Keep every option, ticked or not. -->
- [ ] Bug fix
- [ ] Improvement
- [ ] Feature
- [ ] Refactor
- [ ] Chore
- [ ] Docs
- [ ] Other

## Background and objective
<!-- Everything someone new needs to understand this PR without reading the issue, in plain words: the problem or request and why it matters, the feature or area and how it works today, any relevant history or earlier decisions, and the scope (what's in, what's out, related work). -->

## Done when
<!-- What fixed or delivered looks like. Code Checks, AI UI Testing and the Preview Link, Screenshots and Video sections should show it. -->

## What changed (plain language)
<!-- 3–6 sentences, never more, that anyone understands, non-technical readers included: what the user/system now does differently, and why. No lists, no sub-sections. The context is already in Background and objective; don't repeat it. -->

## Key changes (technical)
<!-- Not a list of every change: the diff and Key files already show that. Only what a maintainer of this repo really needs to know, e.g. a new dependency, a new pattern or abstraction, a schema or API contract change, a new env var or config, a security or performance trade-off. Usually 1–4 bullets, one line each. If nothing qualifies, write n/a. -->
- [what a maintainer must know]
...

## Key files
- [folder]
	- [file]
	- [file]
- [folder or file]
...

## Preview Links (required if UI touched)
<!-- Fill only each of the below. Or a single line comment at the bottom if something very important to mention. Nothing else. -->
Frontend Built Preview: [built preview link for this branch]
	- API 1: Using the production API/built development API/...: url
	- API 2:....: url
	<!-- Choose what makes sense and all databases  -->
	- Database 1 (eg Convex, Postgres, Redis; Prefer the main database first): Connected to the production database/shared development database/local database with fixtures/No database, only fixtures...
	- Database 2:...
Dev Preview: [dev preview link for this branch]
	- API 1...
	- API 2...
	- Database 1...
	- Database 2...

## Screenshots for every screen types (required if UI touched)
<!-- Upload screenshots and the video with gh pr create/edit --attach, never through a branch or outside host. After a review round that changes the UI, replace them here and post the new ones in a PR comment with gh pr comment --attach. -->
| Before | After |
|---|---|
| ![](…) | ![](…) |

## Video (optional when UI is touched. Required for important interactions, animations, etc)
- Video: [link]
- Viewports checked: desktop 1280 / mobile 390
- Console errors: none

## Reuse check (required if API/DB touched)
Searched for: `…` → Found: `…` → Decision: reused / extended / new because …

## Code Checks (Testing, Linting, Building...)
<!-- Work out the repo's checks from the repo itself (package scripts, CI config, tooling, docs): build, format, lint, typecheck, tests. One line per command actually run, with its result. -->
- `[command]` ✅ / ❌ [result in a few words, e.g. N tests, +M new]
- `[command]` ✅ / ❌ [result in a few words]
...

## AI UI Testing
- Manual/agent UI run: [steps tested]
- Evidence: [links to output, screenshots, video]

## Risk
- Risk: low / medium / high. What could break: …
- Breaking change? no / yes → how it's handled: …
- Feature flag: …

## Rollout plan
<!-- Exact context of the rollout plan, step by step. Including steps between PRs -->
None: plain merge
1. Merge this PR
2. Run the backfill in ....
3. Merge the following PR of the stack...
...

## How to revert
Revert this PR / flip flag `…` / run `…`

## Scores (author)
<!-- 1–5 each, plus a required one-line why. -->
Difficulty: _/5. Why: …
<!-- 1 trivial (copy, config, one obvious line) · 2 small, one area, known pattern · 3 several files or one tricky area · 4 cross-layer (DB + API + UI), new pattern or sensitive path · 5 core or hard-to-revert change (migration, auth, payments) -->
Confidence: _/5. Why: …
<!-- 1 guessing, not verified · 2 happy path only, known gaps · 3 main cases tested, some edge cases unchecked · 4 edge cases tested, evidence attached · 5 fully verified with evidence, nothing open -->

## Stack
[k of n; 1 of 1 for a single PR]

## Agent metadata
- Trigger: [Human request: who and where, e.g. Matthieu in Coding Manager chat / Routine: routine name, its schedule or trigger, and the run / Other agent: which agent]
- Device: [MS-A2 / Mac / Grok Bot's computer / …]
- Orchestrator: [T3 Code / Claude Code CLI / Claude Code Desktop / Cursor GUI / Codex CLI / …]
- Thread title: [T3 thread title; "none (headless)" for a headless CLI run]
- Thread id: [T3 thread id; headless CLI run: "Claude session" or "Codex session" plus the session id]
- Role: [Main / Child thread / Headless run; for Child thread and Headless run add the parent thread's title and id]
- Harness: [Claude Code / Codex / Cursor / …]
- Model: [exact model]
- Effort: [exact effort, or n/a if the harness has no effort setting]
- Fast Mode: [On / Off]

## AI review
<!-- One short paragraph per round, only for reviews that ran; n/a plus the reason if none ran. Update after each round. Each review stays on that same line: type name (Approach, Correctness, Design) linked to the review comment, then P-level counts only (or no issues), then → response linked to the answer, then the fix status (omit → response when there are no issues). End the round with Updated in [short sha]. If reviews in the same round landed in different commits, put Updated in [short sha] after each review that had fixes. No extra prose. Review wording: no issues; 1 P1, 2 P3. Response wording: all fixed; 2 of 3 fixed (1 P3 deferred); 1 P2 justified. P-levels are P0–P4. -->
Round 1: [Approach]([review comment]): 1 P1, 2 P3 → [response]([answer]): all fixed. [Correctness]([review comment]): no issues. Updated in [short sha]
Round 2: …
Open findings: none / [e.g. 1 P2]
Waiting on Matthieu: none / [the decision needed, with a link]
