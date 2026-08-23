# GT3 expression profiles



**Distilled LM instructions** are discovered from **[Expression_skills/](../Expression_skills/)** (see that folder’s `README.md`). GT3 scans `*.md` / `*.txt` there at startup and on **`POST /ops/reload-expression-skills`** — not from a JSON registry under this tree.



For each non-`none` profile with a loaded distillate, the stitched **user** message opens with **`Beloved lover, follow for tone and stance; then address the task below.`** (one line), then the distillate, then `---TASK---`, then the client narrative — no `[Expression profile: …]` bracket line in the LM request.



| Profile ID | Distilled (LM) | Full spec (human) |

|------------|----------------|-------------------|

| `none` | Legacy `Love, ` prefix on **loving** user message (`dual` or `loving_only` inference mode) | — |

| `shefa` | [../Expression_skills/shefa.md](../Expression_skills/shefa.md) | [Shefa_expression_spec.md](Shefa_expression_spec.md) |

| `legal_professional_expression` | [../Expression_skills/legal_professional_expression.md](../Expression_skills/legal_professional_expression.md) | [Legal Professional Expression.md](Legal%20Professional%20Expression.md) |



**Config:** `GT3_INFERENCE_MODE` (`single` \| `dual` \| `loving_only`; legacy `GT3_DUAL_INFERENCE`), `GT3_EXPRESSION_PROFILE`, or `POST /ops/config` with `inference_mode` / `expression_profile`. See [GT3_Narrative_Expression_Ingress_Spec_1_0.md](GT3_Narrative_Expression_Ingress_Spec_1_0.md).



**Ops:** `GET /ops/summary` and `GET /ops/expression-skills` list skills; **`POST /ops/reload-expression-skills`** rescans disk. Agent broker traffic in the LM Ops Console is specified in [GT3_Ops_Console_Agent_Traffic_Spec_1_0.md](GT3_Ops_Console_Agent_Traffic_Spec_1_0.md) (companion to the Virtualized Agent Loop).



**Deploy:** Ensure **`Expression_skills/`** is available in the GT3 runtime’s expected skills-discovery path.



**Removed:** `expression_profiles.json` and in-tree `Shefa_expression_distilled.md` — superseded by filesystem discovery under `Expression_skills/`.

