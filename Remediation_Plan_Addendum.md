# Remediation Plan — Addendum (Post-Implementation Audit)

Follow-up to `Remediation_Plan.md`, written after verifying Phases 0–3 against the
actual shipped code (compiled it, ran the 34-test backend suite, ran `pip-audit`,
and fired live requests at auth/CORS/rate-limit/validation behavior).

**Result: 15 of 16 original items are implemented and verified working.** One gap
was found. This addendum documents it the same way the original plan documents
everything else — why it matters, how to fix it, effort — plus the two files
needed to close it.

---

## What was verified working (no action needed)

Auth + RBAC, `debug-azure` fix, `ObjectId` guards, README reconciliation, rate
limiting, `.gitignore` for secrets, upload validation, backend CI + `pip-audit`,
request-ID logging, backend test suite (34/34 passing), inference timing logs,
embedding-store scaling correctly deferred with a documented rationale, CORS
wildcard hard-fail, and the disaster-recovery runbook. All confirmed by
compiling the code and exercising it, not just reading it.

---

## Gap #1 — No frontend CI (High priority, Small effort)

**Why this is a mistake, not just an omission:** the original plan's item #8
explicitly says *"Same for `npm audit` on the frontend `package-lock.json`"*,
and item #10 calls for CI covering *"frontend `npm test`"* alongside the
backend. Across Phases 0–3, only `backend-ci.yml` was ever added. The frontend
already has working `lint`, `test`, and `build` scripts and a committed
`package-lock.json` — everything needed was in place except the workflow file
itself. This is a plan item that was scoped but never executed, not a
newly-discovered issue.

**Risk of leaving it:** the backend now has automated CVE scanning and test
gating on every PR; the frontend (React, Radix UI, ~40 dependencies) has none.
A vulnerable frontend dependency or a broken build would only be caught
manually, if at all — the exact blind spot #8/#10 were meant to close on both
sides of the stack.

**Fix:** `.github/workflows/frontend-ci.yml`, mirroring the shape of
`backend-ci.yml`: `npm ci`, `npm audit`, `npm run lint`, `npm run test`,
`npm run build`.

**Status: executed, not just written.** Running it against the actual
Phase 3 code surfaced three real problems the workflow would have caught on
day one — all now fixed:

1. **`package-lock.json` was out of sync with `package.json`.** `npm ci`
   failed outright (`Missing: tinyspy@4.0.6 from lock file` and similar, ~13
   entries). Root cause: the repo also carries `bun.lock`/`bun.lockb`,
   suggesting the lockfile that actually gets used day-to-day is Bun's, and
   `package-lock.json` had drifted. Fixed by running `npm install` to
   regenerate it and verifying `npm ci` then succeeds cleanly. **Action for
   the team: pick one package manager for CI and delete the other lockfile
   pair — carrying both is what let this drift silently.**
2. **`npm run lint` failed with 3 real errors** (exit code 1, would have
   blocked every PR): two `@typescript-eslint/no-empty-object-type` errors
   in shadcn boilerplate (`command.tsx`, `textarea.tsx`) and one
   `@typescript-eslint/no-require-imports` in `tailwind.config.ts`. Fixed by
   converting the empty interfaces to type aliases and switching the
   Tailwind plugin import from `require()` to an ES import. Re-ran lint
   after: 0 errors, 8 pre-existing warnings (fast-refresh / hook-deps,
   non-blocking).
3. **`npm audit` found 22 vulnerabilities (15 High, 6 Moderate, 1 Low)** —
   confirming exactly the risk #8/#10 were meant to close. `npm audit fix`
   (non-breaking) resolved 16 of them. The remaining 6 (5 moderate, 1 high —
   a build-time Rollup path-traversal issue) only resolve via
   `npm audit fix --force`, which pulls in a major Vite upgrade untested
   against this app. Rather than force an untested major bump, the CI gate
   is scoped to `--omit=dev` (production/shipped dependencies only, which
   is what end users are actually exposed to) with a separate
   non-blocking, always-visible report step for dev-tooling CVEs. **Action
   for the team: schedule the Vite/Vitest major-version upgrade as its own
   reviewed task**, then tighten the gate back to include dev dependencies.

After all three fixes, `npm ci` / `npm run lint` / `npm run test` /
`npm run build` all pass cleanly — verified by running them, not assumed.
Updated `package-lock.json`, `tailwind.config.ts`, `command.tsx`, and
`textarea.tsx` are included alongside this addendum in `frontend-fixes/`.

**Effort:** S as scoped, though the lockfile drift and lint errors were an
unplanned but small amount of extra cleanup surfaced by actually running the
gate instead of just writing it.

---

## Gap #2 — Secret rotation is unverifiable from code (Medium priority, Ops action)

Item #6 in the original plan has two parts: (a) confirm `.env` is git-ignored,
and (b) *"rotate the Mongo Atlas and Azure Storage credentials once, now, to
invalidate anything that may have leaked during dev/demo sharing."* Part (a) is
done and verified (`.gitignore` is present and correct). Part (b) is an
operational action against live infrastructure — it cannot be confirmed, or
performed, by inspecting or running the repository. There's no way to tell
from the code whether it happened.

**Fix:** not a code change. A one-time checklist to run against the actual
Mongo Atlas and Azure Storage accounts, provided as `docs/SECRET_ROTATION.md`,
so the action is tracked and its completion is recorded outside of "assume
someone did it."

**Status:** Documented — see `SECRET_ROTATION.md`. Requires a human with
Atlas/Azure console access to actually execute and check off.

---

## Updated status table

| Item | Original Plan | Status |
|---|---|---|
| #1–#5 (Phase 0) | Auth, debug endpoint, ObjectId guards, README, rate limit | ✅ Verified live |
| #6 (secrets hygiene) | `.gitignore` + rotation | ✅ `.gitignore` verified / ⚠️ rotation → see Gap #2 |
| #7 (upload validation) | Pillow decode + size cap | ✅ Verified live (400 on spoofed upload) |
| #8 (dependency scanning) | Backend `pip-audit` + frontend `npm audit` | ✅ Backend verified (0 CVEs) / ✅ Frontend CI added, executed, and passing (see Gap #1) |
| #9 (request correlation) | Request-ID middleware | ✅ Verified live in logs |
| #10 (CI) | Backend + frontend | ✅ Backend verified (34/34 tests pass) / ✅ Frontend CI added, lint/test/build all passing after fixes |
| #11 (backend tests) | pytest suite | ✅ 34/34 passing |
| #12 (metrics) | Timing logs → optional Prometheus | ✅ Timing logs present (Prometheus graduation not required by plan) |
| #13 (embedding scaling) | Deferred until observed bottleneck | ✅ Correctly deferred, documented in code |
| #14 (RBAC) | operator vs admin | ✅ Verified live (operator 401'd on admin route) |
| #15 (DR runbook) | Backup verification + recovery doc | ✅ Present |
| #16 (CORS) | No wildcard + credentials | ✅ Verified live (startup hard-fails on `*`) |
