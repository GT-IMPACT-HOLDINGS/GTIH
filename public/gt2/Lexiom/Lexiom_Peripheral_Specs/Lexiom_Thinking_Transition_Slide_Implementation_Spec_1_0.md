# Lexiom Thinking Transition Slide — Implementation Specification

- **Version:** 1.0
- **Status:** Implemented baseline (living spec)
- **Type:** Peripheral UX + Runtime Behavior Spec

## 1. Purpose

This specification defines the implemented behavior of Lexiom's `Thinking` transitional slide:

- when it appears,
- where it appears,
- how long it runs (short vs full),
- how it coexists with Black move execution and GT3 inference,
- and how it is rendered visually inside the cockpit.

The slide is a semantic pacing layer (visual mediation), not a logic gate.

## 2. Scope

This spec includes:

- transition trigger rules,
- short/full animation timelines,
- center-playfield-only overlay scope,
- visual style constraints,
- runtime orchestration in `app.js`,
- CSS animation contracts in `styles.css`,
- markup surface in `index.html`.

This spec does not include:

- home-run/Accord wizard transition rules,
- first-entry onboarding intro slides,
- GT3 prompt content design.

## 3. Core Principle

`Thinking` is an asynchronous graphical overlay.

It must not block or delay:

- White->Black reducer flow,
- GT3 inference calls,
- render updates of L1/L2/L3,
- left panel and right panel updates.

The overlay is purely visual and may run while state and rendering continue underneath.

## 4. Runtime Surface

## 4.1 Markup

`index.html` contains a dedicated thinking screen node inside the transition overlay:

- `#lexiom-transition-screen-thinking`
- `#lexiom-transition-thinking-word` (text: `Thinking`)

## 4.2 Controller

`app.js` controls visibility and mode:

- `thinkingTransitionVisibleUntilMs`
- `thinkingTransitionRunId`
- `thinkingTransitionMode` (`short` / `full`)

Main helpers:

- `beginThinkingTransition(mode)`
- `resolveThinkingTransitionMode(...)`
- `renderRoundTransitionOverlay(state)`

## 4.3 Styling

`styles.css` defines:

- arcade font treatment,
- reduced-contrast text behavior,
- short/full keyframes,
- center-playfield overlay constraints.

## 5. Overlay Placement Contract

The `Thinking` overlay must cover only the cockpit center playfield:

- Target frame: `#lexiom-center-playfield`
- Overlay content is positioned by runtime geometry (`getBoundingClientRect`)
- Outside-area darkening is disabled for thinking scope

The main cockpit remains visible and render-active outside the center frame.

## 6. Visual Contract

## 6.1 Text

- Token: `Thinking`
- Style voice: 1980s arcade (pixel-style family)
- Contrast policy: 50% reduced relative peak intensity (`opacity` peaks at `0.5`)

## 6.2 Horizontal breathing room

The thinking word is constrained to approximately 50% of playfield width:

- ~25% free space on left,
- ~25% free space on right.

Runtime font fitting adjusts size downward if needed to prevent overflow.

## 6.3 Background matching

During thinking scope, overlay background is copied from computed center-playfield styles:

- `backgroundColor`
- `backgroundImage`

This preserves theme consistency (light/dark and active-state visuals).

## 7. Temporal Modes

## 7.1 Full mode

Total: **10s**

Sequence:

1. fade-in (2s)
2. hold (2s)
3. fade-out (1s)
4. fade-in again (2s)
5. hold again (2s)
6. final fade-out (1s)

## 7.2 Short mode

Total: **5s**

Sequence (first half of full mode):

1. fade-in (2s)
2. hold (2s)
3. fade-out (1s)

## 8. Trigger Matrix

## 8.1 Short mode triggers

- first cockpit entry via initial external artifact ingestion (`INIT` path),
- post L24 draft approvals:
  - `L23A`
  - `L2_GOALS`
  - `L2_STRATEGY`
  - `L2_UNDISPUTED`,
- every L23 question answer submission (`APPEND_CHAT_MESSAGE` with `contextType: "L2"`), while an L23 chat surface is currently rendered for that topic.

Implementation nuance (L2b/L2c): once `L24_MIN_USER_ANSWERS` is reached for goals/strategy, the center playfield switches to draft-only rendering (`L24b`/`L24c`) and the L23 chat UI is hidden/unrendered for that topic.

## 8.2 Full mode triggers

- L3 click transitions (`L3_CLICK`),
- proposed action draft approval in center playfield (`TOGGLE_APPROVAL` + `ACTION_DRAFT`) on approval rising edge,
- existing document-draft approval cases mapped to full mode.

## 9. Approval Edge Semantics

For action draft approval, the full-mode trigger must fire on approval rising edge and not on toggle-off.

Detection contract:

- compare approved-list lengths before and after White commit:
  - `stateBefore.actionItems.approved.length`
  - `stateAfterWhite.actionItems.approved.length`
- trigger full mode only when `after > before`.

This avoids false negatives caused by proposed-slot reset after approval.

## 10. Non-Interference Requirements

The following are required invariants:

- no `setTimeout` delay before Black reducer execution due to thinking animation,
- `dispatchWhiteMove` continues immediately into Black flow,
- GT3 side effects and post-Black listeners execute normally,
- overlay lifecycle remains independent from inference lifecycle.

## 11. Accessibility and UX Notes

- Text remains single-token and centered for low cognitive load.
- Reduced contrast prevents perceptual aggression while preserving visibility.
- Animation is ceremonial, not obstructive, because it does not block state progression.

## 12. Implementation References

- `public/gt2/Lexiom/app.js`
- `public/gt2/Lexiom/index.html`
- `public/gt2/Lexiom/styles.css`

## 13. Future Extensions (Optional)

- user-level setting for `Thinking` intensity (off/short/full-only),
- locale-sensitive token replacement (e.g., translated `Thinking`),
- reduced-motion variant mapped to system preference,
- telemetry event for mode usage frequency.

## 14. End of Spec

This document is the current implementation contract for the Thinking transition slide. Future modifications should update this spec and keep trigger/timing parity with code.
