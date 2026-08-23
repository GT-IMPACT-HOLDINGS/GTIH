# Lexiom UX Specification — MVP
## Spatial Model v1.0 — *“Lexiom Cabinet” (Zenith + Accord)*

**Status:** MVP — architecturally locked  
**Scope:** Defines cockpit layout, panel internals, entity bindings, and spatial behavior for **Lexiom Accord (shared, inclusive default)** and **Lexiom Zenith (solo, exclusive play option inside Accord’s cabinet)**.  
**Companion Documents:**  
- Lexiom Temporal Model — Arcade Law (Zenith + Accord)  
- Lexiom Provenance Spine Spec (Git-at-the-core)  
- Lexiom Semantic Spec (future)  
- Lexiom Interaction Spec (future)  

---

# 1. Governing Spatial Principle (Calm Procedural Safety)

Lexiom is a **cockpit arcade** designed to make complex legal work feel **safe, contained, and predictable**.

- Each player operates from a **private cockpit**.  
- In **Accord**, multiple private cockpits connect to a **shared harmony layer** (the “Board”).  
- In **Zenith**, the same cabinet is used, but the shared layer is absent/disabled (or empty by design).  
- Nothing meaningful happens outside the cockpit screen.  
- No hidden editors. No floating tools. No background mutations.

Everything is indexed in panels and executed only in the **Center Playfield**.

---

# 2. Global Navigation (Outside the Cabinet)

Minimal persistent bar outside the cockpit:

- Left: GT logo (clickable — opens a sidebar for entering GT3 API keys)  
- Right: Profile, Settings  
- Center: A hyperlinked list of cases

Entering a case transitions into **full-screen cockpit mode** (arcade cabinet feel).  
No global navigation inside a case beyond case actions.

**Zenith vs Accord note:** The global navigation is identical. The difference is only in what the case opens into: a solo cabinet or a shared cabinet.

---

# 3. Cockpit Layout (Per Player)

Spatial proportions: **20 / 60 / 20**, preserving Center dominance.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Top HUD (fixed height): L1 Case Identity + L2 Topic Trio (3)              │
├──────────────┬────────────────────────────────┬───────────────────────────┤
│ Left 20%     │ Center 60%                     │ Right 20%                 │
│ Time Spine   │ Playfield / Activity Renderer  │ Shared Harmony (Top)      │
│ + Stage Tower│ (Only Execution Surface)       │ Private Artifacts (Bottom)│
├──────────────┴────────────────────────────────┴───────────────────────────┤
│ Bottom Ribbon (fixed height): L3 Quick Statements (3)                     │
└───────────────────────────────────────────────────────────────────────────┘
```

**Fixed-height Top HUD and Bottom Ribbon are always visible.**  
Time notions do not exist in the Top HUD.

**Zenith adaptation (spatial):** The cabinet layout remains identical. In Zenith, the **Right-Top “Shared Harmony” area** is present as a panel region but is **disabled/empty** (or replaced with a calm “Solo Mode” placeholder), while **Right-Bottom Private Artifacts** remains fully active.

---

# 4. Top HUD Internals (an horizaontally centered L1, on top of an horizaontally centered L2)

Defines semantic orientation of the case.

Contains: - L1 --- Case Identity - L2 --- Topics.

## 4.1 L1 — Case Identity (Stable Anchor)

- 3–5 words canonical identity  
- Single instance per case  
- After approval becomes stable anchor  
- No inline editing; editing/approving case identity occurs only in Center Playfield Activity

## 4.2 L2 — Topic Trio (3 Discussion Entrypoints)

Lexiom exposes **3** L2 topics.

- Each topic is a **chat discussion entrypoint**  
- Clicking a topic renders a **Conversation Activity** in the Center Playfield  
- The trio is **system-derived during Black Move** and remains stable during the White Move  
- Default selection: **best-fit topic** (auto-selected at the beginning of a Round)

**Zenith vs Accord note:** Topic trio behavior is identical. In Accord, conversation context may be enriched by shared-board published artifacts; in Zenith, context is restricted to the player’s private artifacts (and the case-root directory, if applicable).

---

# 5. Left Panel Internals (Stage Tower + Time Spine)

The Left Panel owns:
- Stage labeling  
- All time notions  
- Past / approved / completed action item ordering  
- Potentially a single proposed Action Item  

## 5.1 Stage-Based Sub-Panels

The Left Panel is split into **Stage sub-panels**, one per stage:

in Zenith mode: a simgle stage named "Zenith"
in Accord mode: "Preparing" → "Opening" → "Exposing" → "Reframing" → "Proposing" → "Resoluting" 

Each sub-panel:
- Displays the stage name  
- Has a designated color tone (UI detail deferred)  
- Contains stage-scoped action items

## 5.2 Focus Rule (Desk-Clearing at Round Start)

At the **beginning of each Round**, only the **current stage sub-panel is expanded**.  
All other stage sub-panels are collapsed, and only current and past/completed stages are visible.

The user may manually expand collapsed visible stage panels at any time.

## 5.3 Stage Sub-Panel Internal Ordering

Inside each stage panel, content order is fixed:

1. **Proposed Action Item Slot (single, current stage only)**  
2. **Approved Action Items (chronological by approval timestamp)**  
3. **Completed Action Items (collapsed list)**

### 5.3.1 Proposed Action Item Slot (Single-Instance Rule)

- At most **one** proposed Action Item may exist (for current stage only) at a time.  
- New Black Move proposals **replace** the previous unapproved proposal.  
- The proposal supports **editing and approval** inside the Center Playfield (clicking an action item opens its description for editing & approval in Center).  
- Approval is a White Move commit, and locks the action item.

### 5.3.2 Approved Action Items

- Ordered by the timestamp of the user's approval  
- No inline editing in the list; click opens the bound Activity in Center  
- Status (%) reflects progress toward completion (derived deterministically from bound artifacts)

### 5.3.3 Completed Action Items (Collapsed)

- Collapsed by default  
- Expands on manual request only

**Zenith vs Accord note:** Left Panel is identical in structure. In Accord, some action items may culminate in “publish to shared” actions; in Zenith, completion culminates in “save as private artifact.”

---

# 6. Center Playfield (Only Execution Surface)

The Center is the only place where work happens.

It renders Activities bound 1:1 to selectable entities across panels:

- Proposed Case Identity approval/edit (draft-first)  
- L2 Topic Conversation (chat)  
- Proposed Action Items editing/approval (draft-first)  
- Action Item Conversation (chat)  
- Proposed drafts of artifacts editing/approval (draft-first)  
- Viewing any shared line item (full view; Accord only)

No secondary editors exist.  
No content expands inside side panels.  
Panels are indexes; Center is the playfield.

**Zenith adaptation:** “Viewing shared line items” is not available; however, the Center still supports viewing **saved documents**  and their metadata if implemented when their bound Activity is open.

---

# 7. Bottom Ribbon (an L3 Quick Strategy Tuning — Always Visible)

The Bottom Ribbon is a fixed-height strip, always visible, alined to center (horizaontally), presenting **3 clickable L3 statements**.

## 7.1 L3 Statement Generation

- Generated as part of every Black Move  
- Always available to the user during their White Move  
- Designed as quick “resonance” selections (fast commit choices)

## 7.2 Clicking an L3 Statement (Commit Semantics)

Clicking an L3 statement:

- Is an explicit approval by the user  
- Signals new user input  
- Completes a White Move commit  
- Emits an AI Bus event  
- Triggers a Black Move recalculation cycle across cockpit components

The ribbon does not publish to the shared layer directly.

---

# 8. Right Panel Internals (Split: Shared Harmony First)

The Right Panel is split into two stacked sub-panels, **Shared Harmony first**.

## 8.1 Top Sub-Panel — Shared Harmony Layer (Board Index) — Accord

Contains only shared canonical artifacts:

- Agreement entries (timeline)  
- Accepted stage transitions  
- Published shared artifacts (agreements / proposals)

Rules:
- No inline expansion  
- No inline editing  
- Clicking any line item renders the full artifact in Center Playfield

### 8.1.1 Zenith Behavior (Solo Placeholder)

In **Zenith**, this area is present but not active as a shared index.

It should render a calm “Solo Mode” placeholder with an invite CTA (“Start Accord session…”)  

**Crucial:** it must not feel broken; it must feel intentionally quiet.

## 8.2 Bottom Sub-Panel — Cockpit-Private Artifacts

Contains **all private artifacts**, including:

- Drafts  
- Approved & explicitly withheld artifacts  
- Saved case documents (downloadable), if implemented

Rules:
- No inline editing  
- Clicking any artifact opens its bound Activity in Center Playfield  
- Withholding/publishing decisions occur only in the Center Activity

# 9. AI Bus (Spatial Contract for Reactive Components)

Lexiom cockpit is componentized.

When a user commits a White Move (including clicking an L3 statement), the system dispatches new context over the **AI Bus**.

Each listening component recalculates independently during the subsequent Black Move, including:

- Left Panel: proposed Action Item slot(s) + ordering updates  
- Top HUD L1, L2: identity, topics recalculation   
- Center Playfield: new drafts / conversation context   
- Bottom Ribbon: next 3 L3 statements  
- Right Panel: private artifact list reshaping; shared layer index refresh (read-only sync; Accord)

**No component may mutate shared state unless the user explicitly publishes via Center Activity.**

**Zenith note:** In Zenith, AI Bus operates with private-only refresh targets.

---

# 10. Indicator System (Pixel Pings, Not Popups)

Lexiom uses small, localized indicators only (no global interruptions):

Potential indicator targets:
- Proposed Action Item slot (Left)  
- Approved items (Left)  
- Shared harmony entries (Right top) when new since last view (Accord)  
- Private artifact entries (Right bottom) when new draft exists  
- L2 topic trio (Top HUD) when new recommended discussion exists  
- L3 ribbon statements (Bottom) when refreshed

Resolution always occurs inside the bound Activity in Center Playfield.

---

# 11. Dashboard (Outside the Cabinet)

The dashboard lists:

- All accessible cases  
- Minimal metadata (current stage + last activity time; optionally last shared entry time for Accord)

Primary CTA: **Create Case**

**Create Case** opens the **case creation passage** (framing prompt + optional case-folder binding + proposed seed handoff) before entering full-screen cockpit; see `Lexiom_Peripheral_Specs/Lexiom_Case_Creation_UX_spec_1_0.md`.

Empty state: quiet arcade hallway — calm, safe, inviting.

---

# 12. Spatial Mental Model (Game Lore)

**Top HUD** → “What is this case, and what are the three discussion doors?”  
**Left Panel** → “Which stage are we in, and what’s my next safe move?”  
**Center Playfield** → “I do everything here.”  
**Right Panel** → “Harmony above; my private inventory below.”  
**Bottom Ribbon** → “Three quick choices; I pick one and the system responds.”

**Accord:** Two (or more) sovereign players. One shared Board. No silent moves.  
**Zenith:** One sovereign player. The Board is quiet. No silent moves.

---

## Appendix A — Zenith as an Exclusive Option Inside Accord

Lexiom is **Accord-first** at the cabinet level:

- The cockpit structure is always the same.  
- Zenith is a **mode** where “Shared Harmony” is intentionally empty/disabled.  
- A Zenith session may be upgraded into Accord by adding collaborators (case-level sharing) and activating the Shared Harmony index.

This preserves a single spatial paradigm while allowing solo play as a fully legitimate and complete experience.
# end of spec