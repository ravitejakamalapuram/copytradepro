# CopyTrade Pro – Refactor & Stabilization Plan (from main)

Goal: Stabilize broker flows and refactor to professional standards with incremental, verified changes from a clean main baseline.

Owner: raviteja / Augment
Branch: feature/pro-refactor-from-main

---

## Principles
- Small, reviewable PRs, merged frequently
- Explicit verification after each change (build, tests, cURL smoke)
- No fallback logic; direct implementations per broker specs
- Shared types and constants across backend/frontend for consistency
- DB as single source of truth; stateless brokers
- Clear error surfaces for diagnosability

---

## Milestones
1) Backend Hardening (Auth, DB, Errors)
2) Frontend OAuth & Account UX Reliability
3) Shoonya Multi-Account Activation/Deactivation
4) Fyers OAuth E2E & Token Refresh
5) Orders: Status, Retry, Notifications
6) Tests, Tooling, and Docs

---

## 1) Backend Hardening (Auth, DB, Errors)
Scope:
- Credentials encryption: defensive handling for undefined/missing
- Credential normalization (Fyers: clientId/secretKey -> appId/secretId)
- OAuth state: derive accountId from state; carry redirectUri
- Standardize error shapes and 400/500 boundaries
- Add health endpoint with build hash/version

Tasks:
- [ ] Mongo adapter: encrypt(text: any) safe stringify; create/update guard for credentials
- [ ] connectBroker: normalize Fyers credentials; return clear error body on 400
- [ ] completeOAuthAuth: accept <pending> accountId; use stateToken to resolve accountId/redirectUri/credentials; clear state on success
- [ ] activateAccount/deactivateAccount: never encrypt undefined; always preserve existing credentials on re-activation
- [ ] Add GET /api/health with { status, buildHash, version, dbConnected }

Verification (cURL):
- [ ] Shoonya connect (happy path)
- [ ] Shoonya deactivate → activate (re-uses saved creds)
- [ ] Fyers connect returns authUrl + stateToken
- [ ] Fyers oauth/complete with pasted full URL/code
- [ ] Errors: return 400 with broker message when broker rejects (not 500)

---

## 2) Frontend OAuth & Account UX Reliability
Scope:
- OAuthDialog: always-enable inputs; parse full URL; handle popup blockers
- Thread stateToken from activate/connect → dialog → complete
- Toasts and UI validation per guidelines; service-layer API usage

Tasks:
- [ ] OAuthDialog: setStep(2) before window.open; accept url or code; clipboard helper
- [ ] AccountSetup: pass stateToken on connect/activate; fallback parsing from full URL
- [ ] accountService: unify response handling; constants for AuthenticationStep, AccountStatus
- [ ] Minimal component tests for URL parse + stateToken threading

Verification:
- [ ] Fyers: connect → redirect → paste URL → complete → account ACTIVE
- [ ] Inputs remain enabled if popup blocked

---

## 3) Shoonya Multi-Account Activation/Deactivation
Scope:
- Add multiple Shoonya accounts; re-activate reliably after manual deactivate
- Persist credentials safely; prevent undefined encryption

Tasks:
- [ ] Ensure update path preserves previous creds on activation unless replaced
- [ ] Improve error pass-through from broker; show actionable messages in UI
- [ ] Add unit tests that simulate: add → deactivate → activate

Verification (cURL):
- [ ] Connect account B (second account) with proper app key + TOTP secret
- [ ] Deactivate A → Activate A; no 500; becomes ACTIVE

---

## 4) Fyers OAuth E2E & Token Refresh
Scope:
- Connect returns top-level authUrl + stateToken (activate path as needed)
- oauth/complete uses state creds + redirectUri
- Refresh tokens used to obtain access token seamlessly

Tasks:
- [ ] Unified broker: ensure completeOAuth returns accountInfo + tokenInfo
- [ ] Persist refresh_token_expiry_time
- [ ] Auto refresh on connect/validate path; update DB
- [ ] Tests for expired/invalid code paths with user-friendly messages

Verification:
- [ ] Connect → auth → complete → ACTIVE
- [ ] Simulate expired access token → refresh → succeeds

---

## 5) Orders: Status, Retry, Notifications (Phase after auth stability)
Scope:
- Order placement logging, failure persistence, retry UI/API
- Manual status refresh (no Shoonya websockets)
- Notifications: Push/Toast integration

Tasks (high level):
- [ ] Standardized order error classifier; store failure reasons
- [ ] Retry/delete endpoints; UI controls
- [ ] Notifications service hooks

Verification:
- [ ] Place, fail, persist reason; retry succeeds
- [ ] Status refresh per broker

---

## 6) Tests, Tooling, Docs
Scope:
- Backend: Jest/unit + lightweight integration with mocks
- Frontend: Vitest/RTL component tests for critical flows
- CI: build + test on PR; lint/type-check gating
- Docs: Flow diagrams, cURL recipes, troubleshooting

Tasks:
- [ ] Add minimal test harness; start with backend auth flows
- [ ] ESLint/TS strict checks; fix ‘any’ types in touched files
- [ ] Docs: docs/broker-flows.md, docs/curl-recipes.md

---

## Coding Standards
- Shared constants: statuses, enums, DB schemas in shared-types
- Service-first architecture; no direct API calls in components
- Exhaustive error handling; pass broker errors to UI
- No dead code; remove legacy paths post-stabilization
- Consistent SCSS patterns; enterprise UI components

---

## Branch & PR Strategy
- Branch: feature/pro-refactor-from-main (parent)
- Small feature branches per PR, e.g.:
  - chore/backend-hardening-1
  - feat/frontend-oauth-reliability
  - fix/shoonya-reactivation
  - feat/fyers-token-refresh
- Each PR:
  - Includes tests + cURL verification notes
  - Adds/updates docs if behavior changes

---

## Risk Mitigation
- Gate behavioral changes behind flags when needed
- Use stateToken for all OAuth-sensitive operations to avoid mismatches
- Prefer 400 over 500 for broker/user errors; keep 500 for unexpected server issues
- Health endpoint + build hash to confirm deployment version

---

## Acceptance Criteria (Phase 1: Auth Stability)
- Shoonya: add, deactivate, activate works for multiple accounts without server errors
- Fyers: connect returns authUrl+stateToken; complete works with pasted URL; refresh token flow validated
- All auth endpoints return structured, user-friendly errors
- Frontend dialogs handle popup blockers; inputs always enabled
- Basic tests pass in CI

---

## cURL Quick Recipes
Shoonya connect:
```
curl -sS 'http://localhost:3001/api/broker/connect' \
  -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' \
  --data-raw '{"brokerName":"shoonya","credentials":{"userId":"<ID>","password":"<PWD>","totpKey":"<BASE32>","vendorCode":"<VENDOR>","apiSecret":"<APP_KEY>","imei":"abc1234"}}'
```
Shoonya (re)activate:
```
curl -sS -X POST 'http://localhost:3001/api/broker/accounts/<accountId>/activate' \
  -H 'Authorization: Bearer <JWT>'
```
Fyers connect (OAuth-required):
```
curl -sS 'http://localhost:3001/api/broker/connect' \
  -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' \
  --data-raw '{"brokerName":"fyers","credentials":{"clientId":"<APPID-100>","secretKey":"<SECRET>","redirectUri":"<REDIRECT>"}}'
```
Fyers complete (manual paste supports state):
```
curl -sS 'http://localhost:3001/api/broker/oauth/complete' \
  -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' \
  --data-raw '{"accountId":"<pending>","authCode":"<CODE>","stateToken":"<STATE_FROM_CONNECT>"}'
```

---

## Next Action
- Create PR: “Plan – Refactor & Stabilization Roadmap”
- Then start PR 1: Backend Hardening (Auth/DB/Errors) + tests + cURL notes

