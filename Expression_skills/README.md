# Expression_skills (distilled LM instructions)

Distilled skill files live here. GT3 **scans this directory** at startup and when **`POST /ops/reload-expression-skills`** runs.

## Rules

- **One skill per file**, top-level only (no subfolders in v1).
- **Extensions:** `.md` or `.txt`.
- **Skill id:** the filename **without** extension, normalized to lowercase. Must match `^[a-z0-9][a-z0-9_-]*$` (e.g. `shefa.md` → id `shefa`).
- **Ignored files:** `_meta.json`, `README.md`, dotfiles.

## Optional metadata

**[_meta.json](_meta.json)** — optional `skills` object keyed by id:

- `label` — shown in the GT3 ops console dropdown.
- `full_spec_ref` — human-readable path or name for logs (not sent to the LM).

## Workflow

1. Add `your_skill.md` with distilled instructions.
2. Optionally add an entry under `_meta.json` → `skills.your_skill`.
3. Call **`POST /ops/reload-expression-skills`** (or restart the server).
4. Open **GT3 console** — the Expression dropdown lists `none` plus every discovered valid skill id.

Full prose specs (non-LM) remain under [GT3_Expression_specs](../GT3_Expression_specs/).
