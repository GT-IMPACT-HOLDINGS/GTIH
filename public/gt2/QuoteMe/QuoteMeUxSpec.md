QuoteMe v1.7 UX Specification (parallel to Legato)
1) Product goal and north-star flow

QuoteMe is a sales-facing web app (English, LTR) that helps a salesperson turn an Opportunity into a customer-ready Engagement Proposal (EP) using the same workflow logic as Legato:
Profile → PA (Proposal Anatomy) → Opportunities → Status/Workplan (AI-assisted) → Approvals → EP generation → EP review/approval/sent.

Core promise: the user stays in control through edit-first, approve-explicitly UX, while GT3 provides “mass-wisdom” drafting (especially for PA) and iterative proposal generation.

2) Primary objects

A. User Profile (global)

Captures profession-related and market-segment context (e.g., role, segment, geo, typical deal size, industry, product/service type).

Created once on first entry; editable later.

B. Proposal Anatomy (PA) (global)

QuoteMe’s equivalent to Legato’s EP template.

Drafted by GT3 immediately after Profile submission.

Stored as a single global artifact per user/tenant, editable anytime.

Must remain fully editable; system never overwrites user edits without explicit user action.

C. Opportunity

The main working unit (equivalent to Legato case).

Contains:

Opportunity title (free text)

Status textarea (same behaviors as Legato)

Workplan textarea (same behaviors as Legato)

Optional attachments / narrative fields only if Legato already has them (v1 mirrors Legato).

D. Engagement Proposal (EP)

Generated automatically on the Opportunity page when Status, Workplan, and PA are approved. EP is displayed directly on the Opportunity page using the draft-field component.

Has its own editable content area(s), approval action(s), and “sent to customer” state (same semantics as Legato).

3) IA and pages
3.1 Landing page (first-run onboarding)

Purpose: collect Profile; immediately generate PA via GT3.

UI: Form with required and optional fields (v1.6):
- **Required fields:**
  - Name (mandatory, top of form)
  - Company Name
  - Industry/Segment
  - Geography
  - Product/Service Category
- **Optional fields:**
  - Role/Title (optional, placed next to Name field)
  - Company Description (optional textarea for general company description)

Primary CTA: “Create my QuoteMe workspace”

On submit:

Validate required fields.

Persist Profile locally (v1 same storage strategy as Legato).

Trigger GT3 inference request: “Generate Proposal Anatomy for this profile.”

Show progress state (“Creating your proposal structure…”).

On success: 
- PA draft is generated and displayed
- User is routed to **Opportunities page** (main app shell)
- **Draft-First UX onboarding modal is shown** on top of the Opportunities page (per `QuoteMeOnboardingModalSpec.md`)
- After onboarding completion, user remains on Opportunities page (modal closes)

**Onboarding modal (v1.7 update):**
- Modal introduces users to Draft-First UX immediately after PA generation
- **Modal appears on Opportunities page** (not PA page) - user navigates to Opportunities first, then modal appears
- Simplified two-step process: (1) Step 1 (PA editing) is skipped when modal appears on Opportunities page, (2) User directly proceeds to Step 2 (Approve via glyph click in modal)
- Modal uses a demo draft-field component with greeting text "Hello {companyName} user"
- Glyph click triggers modal closure after 1-second delay (user remains on Opportunities page)
- Modal only shows once per user (tracked via `quoteme.v1.onboarding.draftFirstSeen` flag)
- See `QuoteMeOnboardingModalSpec.md` for complete details

Failure handling:

If PA generation fails, user still enters the app, but sees a banner: “PA not created yet — retry.” Provide Retry button + copyable error details for transparency.

3.2 Main app shell / Opportunities home

Left sidebar navigation:

- Opportunities
- Proposal Anatomy (PA)
- Profile
- Admin

Main content area:
- Prominent “Create Opportunity” button.

- List of Opportunities with last updated timestamp and quick open.

3.3 PA page (global anatomy editor)

Purpose: review/edit/approve the PA that will guide EP creation.

Layout:

Readable multi-section editor (textarea or structured blocks; v1 can be a textarea to match Legato simplicity).

Buttons:

Save PA

Reset to last saved (optional)

Regenerate from GT3 (optional v1; if included, it must ask confirmation and never auto-overwrite—show diff or create a “proposed version” panel if possible; otherwise omit in v1.)

Explainability hint: small note describing that PA was generated based on Profile + aggregated best practices, and is user-owned/editable.

3.4 Profile page

Purpose: edit the global Profile used for PA and inference generation.

Layout:
- Form with all Profile fields (required + optional), pre-populated with current Profile data
- **Required fields:**
  - Name (mandatory, top of form)
  - Company Name
  - Industry/Segment
  - Geography
  - Product/Service Category
- **Optional fields:**
  - Role/Title (optional, placed next to Name field in a row)
  - Company Description (optional textarea for general company description)
- Same validation as Landing page (required fields must be non-empty)
- "Save Profile" button

Behavior:
- On save: validate required fields
- If Profile changed: prompt "Profile changed—regenerate PA?" (per StateMachineSpec)
- If user confirms: trigger PA regeneration (per InferenceSpec Call A) and revoke PA approval
- If user declines: PA remains unchanged
- Update Profile timestamps (updatedAt)

3.5 Opportunity page (Status/Workplan workflow)

**Opportunity Title field (v1.7 update):**
- Label dynamically shows "(optional)" suffix when the title field is empty
- When user types in the title field, label changes from "Opportunity Title (optional)" to "Opportunity Title"
- Label updates automatically as user types or when title is auto-generated

Purpose: match Legato behavior exactly, with GT2 DraftFirst UX pattern.

Two primary textareas:

Workplan

Status

**DraftFirst UX pattern (per GT2_DraftFirst_MicroUX_Spec.md v1.1):**
- Each field (Status/Workplan) displays with a **header row** containing:
  - **Glyph** (leftmost): authorship + approval indicator (● / ◯ / ◉ / ◯✓)
  - **Label** (2 spaces after glyph): "Status" or "Workplan"
  - **Action buttons** (far right): GT3 generation actions (e.g., upload button for Status)
- **Approval mechanism**: Click the glyph to toggle approval (not a separate "Approve" button)
  - Not approved: glyph shows authorship state (● / ◯ / ◉)
  - Approved: glyph shows ring+check (◯✓)
  - Tooltips: "Click to approve" / "Approved — click to unapprove"
- **Upload action**: Status field header row includes an upload button (📄) for NEW INPUT
  - Clicking upload button opens file picker (.txt, .docx)
  - Upload triggers parallel Status + Workplan generation (atomic)
  - Upload button shows spinner during generation (working state feedback in header row)

**Explicit approvals (via glyph toggle):**
- Approve Status: click Status glyph to toggle approval
- Approve Workplan: click Workplan glyph to toggle approval

**NEW INPUT workflow:**
- Upload document via Status header row upload button
- Extracts text client-side (.txt, .docx supported)
- Triggers parallel Status + Workplan generation (atomic commit)
- Revokes existing approvals automatically

**Engagement Proposal (EP) auto-generates when Status, Workplan, and PA are approved (see EP workflow description below).**

QuoteMe v1 includes **auto-propose Opportunity title** (only if the title field is empty/whitespace).

**v1.7 update - Dynamic label:**
- Opportunity Title label dynamically shows "(optional)" suffix when the title field is empty
- Label text: "Opportunity Title (optional)" when empty, "Opportunity Title" when field contains text
- Label updates automatically as user types or when title is auto-generated

**Note (v1.5):** The dedicated EP.html page has been removed. EP is now fully integrated into the Opportunity page workflow (see EP workflow description above in Section 3.5).

Steps (same semantics as Legato):

Generate EP draft

User edits EP

User approves EP

User marks “Sent to customer”

Admin-only visibility (Admin tools are accessible via a small **Admin** item at the bottom of the left sidebar (v1). A legacy shortcut (e.g., Ctrl+Alt+E) may exist, but is not the primary access path.

3.7 Settings (GT3 API Key Configuration)

Purpose: allow users to enter GT3 API key for inference requests.

Access:
- Click GT2 logo (top-left) to open Settings sidebar (Bootstrap offcanvas)
- Settings sidebar slides in from left

UI:
- Offcanvas sidebar with title "GT3 Settings"
- Password input field labeled "GT3 API Key"
- Helper text: "Key is stored in browser localStorage only."
- "Clear Key" button (outline-danger, small)
- Close button (Bootstrap offcanvas close)

Behavior:
- API key is stored in localStorage under key `quoteme_gt3_api_key` (separate from `quoteme.v1` data blob)
- Key is loaded on page load
- Key is sent in headers `X-GT3-OpenRouter-Key` and `X-GT3-OpenAI-Key` on every inference request (if present)
- Key persists across page reloads
- Key can be cleared via "Clear Key" button

Note: API key is optional but may be required if GT3 server configuration requires it.

4) Key system behaviors

4.1 PA generation (post-profile)

Trigger: immediately after Profile submission.

Output: PA text saved as global artifact.

UX: progress indicator + success confirmation.

If Profile later changes: do not auto-regenerate PA in v1; user can edit PA manually.

4.2 EP generation dependency

EP generation is gated by:

Workplan approved AND Status approved

PA exists (if PA missing, disable EP button and show “Create/restore PA” link)

4.3 Editability and trust

All AI outputs land as editable drafts first.

“Approve” is explicit and reversible only through deliberate user action (e.g., “Unapprove” optional; if not present in Legato, omit).

4.4 Versioning and logs

Reuse Legato’s lifecycle/log concepts (events for inference request/response, approvals).

Admin mode shows underlying inference requests/responses; standard users see only outcomes.

5) Copy, tone, and language

English only; warm but professional.

Button naming (aligned with Legato semantics, adapted to sales):

"Send EP to Customer"

“Approve Workplan”

“Approve Status”

“Approve Proposal”

“Mark as Sent”

6) Success metrics (v1)

Time-to-first-PA (Profile submit → PA created).

Opportunities created per user.

% Opportunities reaching “both approvals.”

EPs generated, approved, and marked sent.

Error rate on GT3 inference calls (with admin-view diagnostics).

7) Out of scope for v1 (explicit)

Multiple PAs per segment/opportunity.

Automated PA regeneration on Profile edits.

CRM integrations and advanced opportunity fields beyond the minimal Legato-like workflow.