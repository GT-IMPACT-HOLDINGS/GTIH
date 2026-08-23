# ODD Testing Specification (v1.0)

---

## 1. Purpose

This document is the single source of truth for how to test the GT1 ODD single-page application.

Scope of this specification:

- Define one canonical automated flow that validates core ODD behavior.
- Define execution, evidence, and alignment-report criteria for that flow.
- Keep future test expansion explicitly open, but out of scope for this file.

---

## 2. System Under Test

- Application: `public/GT1/ODD/index.html`
- Runtime host: GT3 server (`server.js`)
- Primary endpoint under test: `POST /inference`

Current UI assumptions validated by the single flow:

- Single centered playfield.
- Default input text present.
- Enter submits (Shift+Enter inserts newline).
- Loading messages appear during inference (`inferring GT3…`, then `generating visual…`).
- Output area renders inferred text.
- Visual area renders a 128×128 image after the second inference.

---

## 3. Testing Principles (ODD-Aligned)

- Outcome over implementation details.
- Real execution against the running GT3 service.
- Alignment reporting over binary-only pass/fail signaling.
- Test behavior visible and auditable before handoff.
- Human approval before adopting results.

---

## 4. Canonical Single Test Flow (Example)

This flow is the required example and baseline regression test.

### Flow ID

`ODD-E2E-001`

### Preconditions

- GT3 server is up and running on `http://localhost:8080`.
- Test runner can control a real browser engine (headless or headed).

### Steps

1. Navigate to `http://localhost:8080/GT1/ODD/index.html`.
2. Assert heading `Outcome Driven Development` is visible.
3. Assert input is pre-filled with:
   - `e.g., in 50 words, who are you vs. who am I ?`
4. Submit with Enter key.
5. Verify loading indicator shows `inferring GT3…` while the first request is in-flight.
6. Verify output area (`inferred output`) becomes non-empty.
7. Verify a second `POST /inference` completes and **inferred visual** contains a 128×128 `img.odd-visual-img`.
8. Verify no fatal inline error text is shown in the textual output area.

### Expected Result

- Flow executes successfully and captures the inferred output to:
  - `test-results/odd-inference-capture.json`
- A textual alignment report is produced:
  - `test-results/odd-alignment-report.json`
  - `test-results/odd-alignment-report.md`

### Failure Result

- Any failed assertion, runtime exception, network failure, invalid response shape, or missing capture/report artifact fails the run (`non-zero exit code`).

---

## 5. Execution Contract (Before Handoff)

The assistant should trigger the canonical test flow before handoff after relevant ODD changes.

Minimum evidence expected:

- Terminal summary including alignment score and verdict.
- Rule-level findings with evidence quotes from the inferred output.
- Browser trace/screenshot artifacts on failure (if runner is configured for it).
- Saved capture and report artifacts under `test-results/`.

Recommended command pattern (final script names may vary once wired):

- `npm run prehandoff:odd`

Command behavior:

1. Run canonical browser flow (`ODD-E2E-001`) and capture inferred output.
2. Evaluate captured output with an LLM judge against ODD expression rules.
3. Emit textual alignment report (`.json` and `.md`) and apply score threshold gate.

---

## 6. Alignment Score Gate

Release gate for ODD UI-related changes:

- Required score: **>= 98 / 99**
- Pass: alignment score meets threshold.
- Block: score below threshold, until fixed or explicitly waived by a human reviewer.

### Alignment Report Contract

Expected JSON report fields:

```json
{
  "flow_id": "ODD-E2E-001",
  "score_0_to_99": 98,
  "threshold": 98,
  "verdict": "pass",
  "summary": "string",
  "rule_findings": [
    {
      "rule": "string",
      "status": "pass|fail|partial",
      "evidence": ["string"]
    }
  ],
  "improvement_actions": ["string"]
}
```

---

## 7. Responsibility Mapping

- Trigger and monitor execution: Human operator.
- Interpret failures and decide remediation: Human.
- Approve handoff after green run: Human.

---

## 8. Out of Scope in This Spec

This file intentionally does not define the full testing matrix.

Future expansion (to be defined in a separate specification) should include:

- Additional functional flows (validation edge cases, error-path variants, keyboard/accessibility detail).
- Non-functional tests (performance, resilience, security, load, reliability).
- Cross-browser matrix and environment coverage policy.
- CI orchestration and quality gates at branch/PR level.

---

## 9. Follow-Up Specification Placeholder

Create a separate follow-up document for broader test coverage, for example:

- `ODD_test_expansion_specification.md`

That follow-up should reference this file and treat `ODD-E2E-001` as the immutable baseline flow.
