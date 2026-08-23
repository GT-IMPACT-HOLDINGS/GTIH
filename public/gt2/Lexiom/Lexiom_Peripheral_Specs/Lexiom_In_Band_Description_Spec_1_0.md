# Lexiom In-Band Description Specification (v1.0)

> **Purpose**
> This specification defines Lexiom's use of the **GT3 in-band communication mechanism** for the `in_band_description_of_Lexioms_act`: a 6-word phrase embedded at the tail of each GT3 inference response. The phrase assists admins in understanding the linguistic act the GT3 LM performed within Lexiom's app context.

> **Scope**
> Applies to all Lexiom GT3 inference calls. This spec extends the generic mechanism defined in [GT3_Inference_In_Band_Context_Spec_1_0](../../../../GT3_Inference_In_Band_Context_Spec_1_0.md) with Lexiom-specific format, prefix rules, and semantic composition.

> **Prerequisite**
> Read the generic [GT3 In-Band Inference Context Spec](../../../../GT3_Inference_In_Band_Context_Spec_1_0.md) for protocol flow, extraction, stripping, and server uses.

---

## 1. Overview

Lexiom uses the in-band mechanism so that inference log files and admin tooling can display a human-readable description of *what linguistic act* the LM performed. The phrase is named **in_band_description_of_Lexioms_act** (or "in-band description" for short).

The phrase has two structural parts:
1. **Prefix (2 words)**: Label and act type — enables quick admin recognition of the inference category (L23, L24, LP, RP, L2_Refresh).
2. **Body (4 words)**: Subjective and objective semantic vectors within the Case's semantic realm — describes the content/result of the act.

---

## 2. Format: 6-Word Phrase

### 2.1 Syntax

The `in_band_description_of_Lexioms_act` is exactly **six** alphanumeric words separated by underscores. It must appear as the **last token** in the response — the sequence of characters beyond the last whitespace (space, newline, or tab). The phrase must **begin with an underscore (`_`)** as the in-band signaling mark; the GT3 server strips only when the last token starts with `_` (see [GT3 In-Band Spec](../../../../GT3_Inference_In_Band_Context_Spec_1_0.md) §3.1).

**Structure:** `_prefix_word1_prefix_word2_body_word1_body_word2_body_word3_body_word4`

**Constraints:**
- Must begin with `_` (the in-band signaling mark).
- Exactly six words, underscore-separated. Use ONLY underscores between words — no slashes, hyphens, spaces, or other characters. Each word is letters and numbers only. (The server tolerates minor deviations such as a trailing period by sanitizing before use.)
- The phrase must be preceded by whitespace so it forms the last token.
- Maximum length: 120 characters.

### 2.2 Script and language (English / Latin only)

The in-band phrase is a **machine-oriented signing token** for logs and admin tooling. It MUST use **English words in Latin script** only: each of the six words must contain **ASCII letters (`A`–`Z`, `a`–`z`) and/or ASCII digits (`0`–`9`)** — no Hebrew, Arabic, Cyrillic, CJK, combining marks, or other Unicode letters, even when Lexiom’s **LANGUAGE** directive asks for non-English main output.

**LM guidance:**
- If the case or main response is in another language, still encode the four-word body using **English** semantic descriptors or **standard English transliteration** of names/concepts (not native script).
- Do not copy non-Latin text from the user’s input into the in-band phrase.
- The **LANGUAGE** rule applies to the main inference body; the final in-band line is **explicitly exempt** from non-English LANGUAGE and must remain English/Latin per this section.

---

## 3. Prefix Rules (Act Label + Initials)

The first two words form a **prefix** that identifies the inference type. The LM must use one of the following prefixes according to the narrative context:

| Inference Type | Prefix (after leading `_`) | Description |
|----------------|---------------------------|-------------|
| L23 question-request | `_L23_Clarify_` | Lexiom asks a clarifying question; user answers in L23 chat. |
| L24 list/narrative-request | `_L24_Draft_` | Lexiom drafts a list or narrative (L24a/b/c/d tensions, goals, strategy, undisputed). |
| Transient draft (Accord seed) | `_Transient_Draft_` | GT3 drafts the Accord shared seed narrative in a transient/log-naming context. |
| L2 refresh | `_L2_Refresh_` | Lexiom refreshes L1 title/summary and L2 topic labels when L1 changes. |
| Left-Panel proposed-action | `_LP_Draft_` | Lexiom proposes a single next executable step for the user. |
| Right-Panel artifact filename | `_RP_Draft_` | Lexiom proposes a short filename for the artifact resulting from an accepted action. |
| Right-Panel artifact content | `_RP_Draft_` | Lexiom drafts the initial narrative content for the artifact resulting from an accepted action. |

**Examples of full 6-word phrases (each begins with `_`):**
- `_L23_Clarify_tenant_deposit_return_intent` — L23 question about deposit return
- `_L24_Draft_tensions_damages_liability_claims` — L24a tensions draft
- `_LP_Draft_followup_email_attach_documentation` — Left-panel proposed action
- `_RP_Draft_name_for_demand_letter` — Right-panel filename proposal (task: naming)
- `_RP_Draft_content_of_demand_letter` — Right-panel artifact content draft (task: drafting content)

---

## 4. Semantic Composition

### 4.1 First Person Present Simple (In-Band Phrase Only)

The first-person phrasing applies **only to the in-band phrase** (the semantic fingerprint after the prefix), not to the main inference output. The main response (e.g. proposed action, draft text, question) must follow its own OUTPUT rules. Examples for the in-band phrase:
- "I clarify…" → prefix `_L23_Clarify_`
- "I draft…" → prefix `_L24_Draft_`, `_LP_Draft_`, `_RP_Draft_`
- "I refresh…" → prefix `_L2_Refresh_`

### 4.2 Body: Subjective and Objective Vectors

The **four words following the verb** (i.e., the body) must include:
- **Subjective vectors**: Aspects that reflect the user's perspective, intent, or stance within the Case.
- **Objective vectors**: Aspects that reflect factual, structural, or shared elements in the Case's semantic realm.

Together, the four words should describe *what* the LM's output addresses or delivers in terms of the Case's semantic terrain.

**Guidance for the LM:**
- Choose nouns, noun phrases, or compact descriptors that map to the Case's disputes, goals, strategy, undisputed facts, actions, or artifacts.
- Avoid generic filler; each word should carry semantic weight.
- The body need not be grammatically a full clause; it is a compressed semantic fingerprint.

### 4.3 Task-Reflective Body (Essential)

The body **must reflect the TASK** expressed in the inference request, not only the subject matter. The in-band phrase describes the *linguistic act* the LM performed — which includes *what kind of act* (e.g., naming, drafting content, proposing an action) and *what it applies to*.

**Principle:** Read the TASK line in the narrative. Encode both (a) the task type and (b) a compact semantic identifier for the artifact/subject in the four-word body.

**Examples by task:**
| TASK in inference request | Body pattern | Example phrase |
|---------------------------|--------------|----------------|
| Propose a short filename for the artifact | `name_for_<artifact>` | `_RP_Draft_name_for_demand_letter` |
| Draft the initial narrative content for the artifact | `content_of_<artifact>` or `draft_of_<artifact>` | `_RP_Draft_content_of_demand_letter` |
| Propose exactly one next executable step | `proposed_action` + subject | `_LP_Draft_send_demand_letter_today` |

---

## 5. Micro-Inference Descriptive Instructions

Lexiom appends a **micro-inference instruction** to each narrative. The instruction varies by inference type so the LM uses the correct prefix and composes the body accordingly. Every template includes the **ENGLISH_ONLY** rule: the in-band line must stay English/Latin ASCII regardless of **LANGUAGE** on the main response.

### 5.1 Instruction Template (by inference type)

**Shared tail (append to every type’s block in production):**  
`ENGLISH_ONLY (in-band line): The entire in_band_description_of_Lexioms_act must use English (Latin script) only — ASCII letters and digits per word. Do not use non-Latin script in this phrase even when LANGUAGE requires another language for the main body.`

**L23 (question-request):**

```
IMPORTANT: End your response with exactly one line containing the in_band_description_of_Lexioms_act. The phrase MUST begin with an underscore (_).
Format: _L23_Clarify_ followed by four words. Use ONLY underscores to separate words; no slashes, hyphens, or spaces. Example: _L23_Clarify_tenant_deposit_return_intent. The first-person phrasing applies ONLY to this phrase, NOT to your main response. Put it on its own line at the very end. No other text after it. ENGLISH_ONLY: six Latin/ASCII words only (see §2.2).
```

**L2 refresh:**

```
IMPORTANT: End your response with exactly one line containing the in_band_description_of_Lexioms_act. The phrase MUST begin with an underscore (_).
Format: _L2_Refresh_ followed by four words. Use ONLY underscores to separate words; no slashes, hyphens, or spaces. The first-person phrasing applies ONLY to this phrase, NOT to your main response. Put it on its own line at the very end. No other text after it. ENGLISH_ONLY: six Latin/ASCII words only (see §2.2).
```

**L24 (list/narrative-request):**

```
IMPORTANT: End your response with exactly one line containing the in_band_description_of_Lexioms_act. The phrase MUST begin with an underscore (_).
Format: _L24_Draft_ followed by four words. Use ONLY underscores to separate words; no slashes, hyphens, or spaces. The first-person phrasing applies ONLY to this phrase, NOT to your main response. Put it on its own line at the very end. No other text after it. ENGLISH_ONLY: six Latin/ASCII words only (see §2.2).
```

**TRANSIENT_DRAFT (Accord shared-seed transient naming):**

```
IMPORTANT: End your response with exactly one line containing the in_band_description_of_Lexioms_act. The phrase MUST begin with an underscore (_).
Format: _Transient_Draft_ followed by four words. Use ONLY underscores to separate words; no slashes, hyphens, or spaces. The first-person phrasing applies ONLY to this phrase, NOT to your main response. Put it on its own line at the very end. No other text after it. ENGLISH_ONLY: six Latin/ASCII words only (see §2.2).
```

**LP (Left-Panel proposed-action):**

```
IMPORTANT: End your response with exactly one line containing the in_band_description_of_Lexioms_act. The phrase MUST begin with an underscore (_).
Format: _LP_Draft_ followed by four words. Use ONLY underscores to separate words; no slashes, hyphens, or spaces. The first-person phrasing applies ONLY to this phrase, NOT to your main response. Put it on its own line at the very end. No other text after it. ENGLISH_ONLY: six Latin/ASCII words only (see §2.2).
```

**RP_filename (Right-Panel artifact filename proposal):**

```
IMPORTANT: End your response with exactly one line containing the in_band_description_of_Lexioms_act. The phrase MUST begin with an underscore (_).
Format: _RP_Draft_ followed by four words that reflect the TASK (name for) and the artifact. Use ONLY underscores to separate words; no slashes, hyphens, or spaces. Example: _RP_Draft_name_for_demand_letter — the task is naming, the artifact is demand letter. Put it on its own line at the very end. No other text after it. ENGLISH_ONLY: six Latin/ASCII words only (see §2.2).
```

**RP_content (Right-Panel artifact content drafting):**

```
IMPORTANT: End your response with exactly one line containing the in_band_description_of_Lexioms_act. The phrase MUST begin with an underscore (_).
Format: _RP_Draft_ followed by four words that reflect the TASK (content of) and the artifact. Use ONLY underscores to separate words; no slashes, hyphens, or spaces. Example: _RP_Draft_content_of_demand_letter — the task is drafting content, the artifact is demand letter. Put it on its own line at the very end. No other text after it. ENGLISH_ONLY: six Latin/ASCII words only (see §2.2).
```

### 5.2 Narrative-to-Instruction Mapping

| Narrative / Call Site | Inference Type | Prefix |
|-----------------------|----------------|--------|
| L23 chat (disputes, goals, strategy, undisputed) | L23 question-request | `_L23_Clarify_` |
| L24a (disputes), L24b (goals), L24c (strategy), L24d (undisputed) | L24 list/narrative-request | `_L24_Draft_` |
| Accord shared seed narrative generation (transient) | TRANSIENT_DRAFT | `_Transient_Draft_` |
| buildL1RefreshNarrative, buildL2RefreshNarrative | L2 refresh | `_L2_Refresh_` |
| buildProposedActionNarrative | LP proposed-action | `_LP_Draft_` |
| buildArtifactFilenameNarrative | RP_filename (artifact filename) | `_RP_Draft_` |
| buildArtifactContentNarrative | RP_content (artifact content) | `_RP_Draft_` |

---

## 6. Alignment with GT3 Generic Spec

This spec conforms to the [GT3 In-Band Inference Context Spec](../../../../GT3_Inference_In_Band_Context_Spec_1_0.md):

- **§3.1**: GT3 server strips the last token when it begins with `_` (in-band signaling mark).
- **§3.2**: Lexiom uses a 6-word phrase beginning with `_`; the client appends the micro-inference instruction by inference type.
- **§4.1**: GT3 uses the phrase for log file renaming; Lexiom's phrases produce readable filenames like `_L24_Draft_disputes_damages_liability_claims.<uuid>.txt`. The server sanitizes minor LM deviations (e.g. a trailing period) before validation; the phrase still renames correctly.

---

## 7. Blocklist (Server-Side)

The GT3 server may block certain phrases from being used for log file renaming (e.g., instruction examples the LM may copy). Lexiom's blocklist should include legacy 4-word examples that are no longer valid in the 6-word format. Coordination with [GT3 In-Band Spec](../../../../GT3_Inference_In_Band_Context_Spec_1_0.md) §5 is required when updating blocklists.

---

## 8. Implementation References

| Component | File | Notes |
|-----------|------|-------|
| Client instruction builder | `public/gt2/Lexiom/gt3-client.js` | Select instruction by inference type (L23, L24, LP, RP_filename, RP_content, L2_REFRESH) |
| Narrative builders | `public/gt2/Lexiom/inference-narratives.js` | Pass inference type to instruction builder |
| App call sites | `public/gt2/Lexiom/app.js` | Pass inferenceType (e.g. RP_filename, RP_content) to callGT3 |
| Server extraction | `server.js` | `extractAndStripInBand` — extracts last token, strips when it starts with `_` |

---

## 8.1 Known divergence (runtime diagnostics vs protocol)

- **Known divergence:** `gt3-client.js` runtime debug marker detection currently logs only when response includes `_L24_Draft_`, `_L23_Clarify_`, `_LP_Draft_`, `_RP_Draft_`.  
- This does **not** include `_L2_Refresh_` or `_Transient_Draft_` in the diagnostic check, even though both are valid prefixes per this spec.
- **Assumption:** extraction/stripping correctness remains server-authoritative (`extractAndStripInBand`), so this divergence affects client-side debug visibility rather than protocol validity.
- **Follow-up required:** extend client diagnostic matcher to include all allowed prefixes to avoid false “missing marker” impressions during troubleshooting.

---

## 9. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | (draft) | Initial 6-word in_band_description_of_Lexioms_act; prefix rules L23/L24/LP/RP; semantic composition |
| 1.1 | (draft) | §4.3 Task-reflective body: body must reflect TASK from inference request; RP split into RP_filename and RP_content with task-specific instructions |
| 1.2 | (draft) | §2.1: Server tolerance for minor LM deviations (trailing punctuation); §6: Sanitization note; §8: Implementation references updated (extractAndStripInBand, RP_filename/RP_content, app.js) |
| 1.3 | (draft) | §2.2 English/Latin-only in-band script; §5 shared ENGLISH_ONLY tail; `gt3-client.js` ENGLISH_ONLY instruction + LANGUAGE exception for in-band line |
| 1.4 | (draft) | Added `_Transient_Draft_` inference type for Accord shared-seed transient/log naming. |
