# QuoteMe TeamSpace — Coordination Log

---

## ASK: GTL3 — Confirm GT3 Endpoint Contract for QuoteMe

**Who:** GTL3  
**What:** Verify QuoteMe's planned request headers/metadata match GT3's current expectations  
**Why:** QuoteMe reuses Legato endpoints exactly, but want confirmation that our planned `tenant/app/track/consent` values are correct before Step 4 (GT3 Client Wrapper)  
**Blocked On:** None — can proceed with Legato patterns, but confirmation reduces risk  
**Minimal Acceptance Criteria:**
- GTL3 confirms: `X-GT3-Tenant: "gt2-quoteme-dev"` is acceptable (or suggests alternative)
- GTL3 confirms: `X-GT3-Data-Track: "green"` is acceptable for QuoteMe v1
- GTL3 confirms: `/inference` endpoint accepts `{ narrative: string }` and returns `{ response: string }` (as Legato currently uses)

**Status:** Pending  
**Priority:** Medium (helpful but not blocking)

---

## ASK: GTL3 — GT3 Response Metadata for Observability

**Who:** GTL3  
**What:** Does GT3 return provider/model/latency information in response headers or body?  
**Why:** QuoteMe ObservabilitySpec requires logging `provider`, `model`, `latencyMs` in audit payloads. If GT3 provides this, we want to capture it.  
**Blocked On:** None — can log `null` if unavailable, but better to capture if GT3 provides it  
**Minimal Acceptance Criteria:**
- GTL3 documents: where provider/model/latency appear (response headers? response body? separate endpoint?)
- Or GTL3 confirms: QuoteMe should log `null` for these fields in v1

**Status:** Pending  
**Priority:** Low (nice-to-have, not blocking)

---

## ASK: GTdevOps — Test GT3 Instance for QA

**Who:** GTdevOps  
**What:** Provide a stable GT3 test instance URL for QuoteMe QA scenarios (or confirm localhost:8080 is sufficient)  
**Why:** QuoteMeQASpec requires integration tests against real GT3 instance. A dedicated test instance is preferred, but localhost works too.  
**Blocked On:** None — can use localhost:8080, but dedicated test instance is better  
**Minimal Acceptance Criteria:**
- GTdevOps provides: GT3 test instance URL (or confirms localhost:8080 is sufficient)
- GTdevOps confirms: test instance can handle parallel requests (for Status+Workplan atomic calls)

**Status:** Pending  
**Priority:** Low (can proceed with localhost)

---

## Notes

- QuoteMe v1 implementation work plan is complete: `QuoteMeV1ImplementationWorkPlan.md`
- Implementation will proceed incrementally, starting with Day-1 tasks
- All asks above are non-blocking; implementation can begin immediately

---

*Last updated: 2025-01-XX (by GTL2)*
