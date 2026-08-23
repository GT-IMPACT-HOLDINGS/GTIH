# Lexiom Auto-Focus Guidance UX Specification

- **Version:** 1.0
- **Status:** Active
- **Type:** Peripheral Functional/Behavioral UX Spec

## 1. Purpose

This specification defines how Lexiom should guide user attention by automatically moving focus to the next relevant work surface.

The objective is to reduce manual navigation friction while preserving user control.

## 2. Scope

This spec defines behavior for:

- automatic focus when a newly available L2 lane becomes accessible,
- automatic focus to Proposed Action after approval of the undisputed draft lens,
- automatic focus to the seed artifact when entering cockpit with a seed-backed case,
- automatic focus to newly composed right-panel artifacts produced from accepted actions.

This spec does not define:

- model prompt composition,
- language translation behavior,
- text direction rules,
- home-run transition visuals,
- approval criteria for draft content.

## 3. UX Principles

- **Guidance, not lock-in:** auto-focus points the user to the next likely step but does not prevent manual navigation elsewhere.
- **Single focal surface:** after each trigger, one clear center-playfield surface should become active.
- **Consistent visual confirmation:** the corresponding navigation element must appear highlighted when focus moves.
- **No redundant jumps:** if the target surface is already active, no additional focus shift should occur.

## 4. Behavioral Contract

## 4.1 Newly available L2 lane

When an L2 lane first becomes available to the user, Lexiom automatically opens that lane in the center playfield.

Expected result:

- center playfield shows the newly available L2 work area,
- the corresponding L2 control appears active.

## 4.2 Undisputed draft approval -> Proposed Action

When the undisputed draft reaches approved state, Lexiom automatically moves focus to Proposed Action.

Expected result:

- Proposed Action appears active in the left panel,
- Proposed Action draft content is shown in the center playfield.

## 4.3 First cockpit entry with seed-backed case

When cockpit starts from a seed-backed case, Lexiom automatically opens the seed artifact in the center playfield.

Expected result:

- seed artifact content is immediately visible without an extra click,
- the matching artifact entry appears active.

## 4.4 New composed artifact from accepted action

When a newly composed artifact is created from an accepted action, Lexiom **should** automatically shift focus to that artifact.

### Known divergence (current implementation)

- Artifact creation from approved action (`APPEND_ARTIFACT_FROM_ACTION`) is implemented.
- Automatic navigation to the newly created artifact is **not** currently dispatched as part of that flow.
- User can open the new artifact from right-panel list; no silent focus jump occurs today.

## 5. Safety and Non-Goals

- Auto-focus must not change approval state by itself.
- Auto-focus must not prevent the user from manually changing focus afterward.
- Auto-focus must not alter semantic content; it only changes presentation focus.
- Auto-focus must not create repeated visual jumps for the same already-active target.

## 6. Acceptance Criteria

- Each trigger in section 4 produces exactly one visible focus destination.
- Destination content appears in center playfield immediately after trigger completion.
- Matched navigation surface is highlighted at the same time.
- Manual user navigation remains available at all times.

**Temporary behavior:** criterion above applies to implemented triggers in §4.1–§4.3. Section §4.4 remains a documented target behavior and is currently manual-open.

## 7. Future Extensions (Optional)

- user preference toggle for auto-focus guidance (`off` / `on`),
- per-trigger toggles (L2, Proposed, seed, composed artifacts),
- analytics for trigger frequency and manual override patterns.

## 8. End of Spec

This document is the functional and behavioral contract for Lexiom auto-focus guidance UX.
