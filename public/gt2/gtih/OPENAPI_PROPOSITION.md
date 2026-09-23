# GTIH OpenAPI proposition — integrating SDK and UIs

**Status:** Proposition (v0.1)  
**Companion:** [`openapi.yaml`](./openapi.yaml) · human overview [`API.md`](./API.md)  
**Substrate:** Lexiom 1.3 GT3 routes (`/lexiom13/*`, `POST /inference`) — no new backend for v0.1  

**Consumers** (all **in parallel**, not sequenced as “Tegria after GTIH”):

- **Lexiom 1.3** — offers and migrates onto the GTIH SDK  
- **Tegria** instrument SPA — GTIH directly (transport proof), parallel with Lexiom migration  
- **Tegria UI / Tegria SDK** — **parallel** vertical track: wrapper over GTIH that may integrate **domain-related and/or tenant-bounded** data from a **remote Tegria server**, for the user/player’s benefit, thereby **increasing the economic value** of the unified SDK for that vertical’s consumers  
- **The Reasoning Hub (TRH)** — GTIH SDK **directly** (no Tegria tenant plane), parallel with the above

---

## 1. Why OpenAPI here

Vertical UIs must not each invent a `fetch` map. Integration order of *layers* (not a calendar that postpones Tegria):

1. **OpenAPI** names the stable HTTP garden (`gtih/0.1`).
2. **`gtih-sdk.js`** implements it as `window.gtih` (thin wrappers) and **owns connectivity** (autodiscovered GTIH origin from the script URL).
3. **Lexiom, TRH, Tegria SPA, and Tegria SDK** consume GTIH **concurrently** by loading that one SDK asset; Tegria’s wrapper adds vertical capital when that track needs it.

```text
Lexiom / TRH / Tegria SPA  →  GTIH SDK (operationIds + baseUrl)  →  OpenAPI paths  →  GT3
Tegria UI (parallel)       →  Tegria SDK wrapper
                              ├→ GTIH SDK              →  GT3
                              └→ remote Tegria server  →  domain / tenant-bounded player data
```

**Clean cut:** UI hosts do not proxy or hardcode `/lexiom13` / ports. Pre-execution knowledge is only the absolute URL of `gtih-sdk.js` on the GTIH host.

Not Lexiom 1.4 Bearer/SSE (`/lexiom14/v1/*`). GTIH behavior stays Lexiom 1.3-identical.

---

## 2. Scope

### In scope (SPA / TRH-facing)

| Capability group | OpenAPI tag | HTTP surface |
|------------------|-------------|--------------|
| OSNG manipulation | `osng` | list, load YAML, save create/update/prune |
| GT3 direct inference | `gt3` | `POST /inference` |
| Hanuman control plane | `hanuman` | prepare, run, status, evidence collections, bud GETs |

### Out of scope for GTIH OpenAPI v0.1 (Hanuman labor)

- `GET|POST /lexiom13/build/session/:sessionId/*`
- `POST /v1/agent/:runId/:pass/chat/completions`

They may also sit under tag `hanuman-labor` if a host other than Lexiom drives the devotee.

---

## 3. GTIH SDK ↔ OpenAPI operation map

`operationId` values are normative; SDK methods group under `gtih.*`. Extension field: `x-gtih-sdk`.

| `operationId` | GTIH SDK method | Method + path |
|---------------|-----------------|---------------|
| `osngList` | `gtih.osng.list()` | `GET /lexiom13/osn/list` |
| `osngGetYaml` | `gtih.osng.getYaml(path)` | `GET` public OSN YAML path |
| `osngSave` | `gtih.osng.create` / `update` / `delete` | `POST /lexiom13/osn/save` |
| `gt3Infer` | `gtih.gt3.infer(...)` | `POST /inference` |
| `hanumanPrepare` | `gtih.hanuman.prepare(...)` / `prepareFromOsngEnvelope(...)` | `POST /lexiom13/build/prepare` (canon id, `osng_envelope`, or `proposal_run_id`) |
| `hanumanRealize` | `gtih.hanuman.realize(...)` | `POST /lexiom13/build/run` |
| `hanumanGetStatus` | `gtih.hanuman.getStatus(runId)` / `watchStatus` / `realizeUntilDone` | `GET /lexiom13/build/status/{runId}` |
| `hanumanListEvidenceCollections` | `gtih.hanuman.listEvidenceCollections(osnId)` | `GET /lexiom13/evidence/collections` |
| `hanumanGetEvidenceArtifact` | helper | `GET /lexiom13/evidence/artifact/{runId}/{relPath}` |
| `hanumanGetBudPreview` | helper | `GET /lexiom13/preview/{runId}/{relPath}` |
| `hanumanGetBudArtifact` | helper | `GET /lexiom13/build/{runId}/artifact/{entry}` |

**Client-only helpers:** `getApiKey` / `setApiKey`, `watchStatus` (poll over `hanumanGetStatus`).

Relationships / content / evidence defs travel inside the OSN on save — not separate resources.

---

## 4. Auth

| Mechanism | Where |
|-----------|--------|
| None | Most `/lexiom13/*` on reachable local GT3 |
| Optional `X-GT3-OpenRouter-Key` (+ `X-GT3-OpenAI-Key` on inference) | `gt3Infer`, `hanumanRealize` |
| Fixed product headers on inference | Tenant / data-track / consent / persona (SDK defaults) |
| No cookies / no Lexiom 14 Bearer | v0.1 |

---

## 5. Errors

`{ "detail": "<message>" }` on 4xx/5xx. GTIH SDK throws `Error` with that message when present.

---

## 6. Async progress

HTTP polling of `hanumanGetStatus` (no SSE). `watchStatus` is client convenience. Evidence: poll `hanumanListEvidenceCollections`.

---

## 7. Integration sequence (parallel tracks)

1. Treat [`openapi.yaml`](./openapi.yaml) as the named garden (`gtih/0.1`).
2. Implement `gtih-sdk.ts` per `operationId` / `x-gtih-sdk`.
3. **In parallel:** Lexiom migrates transport; Tegria instrument SPA and TRH load the same `gtih-sdk.js`; Tegria SDK wraps GTIH for Tegria UI (plus remote domain/tenant data as that vertical needs).
4. Optional codegen from YAML — not required for v0.1; does not gate Tegria work.

---

## 8. Non-goals

- Redesigning `/lexiom13` bodies
- Replacing `/inference` with `/v1/agent/...`
- Documenting Ops or classic Lexiom
- Requiring TRH to go through Tegria
- Specifying Tegria remote server APIs here (those belong to the Tegria wrapper / vertical contract; they **add** economic value atop GTIH, they do not redefine GTIH)

---

## 9. Versioning

- Document id: `gtih/0.1`
- Drift → bump `info.version` + note Known divergence vs Lexiom 1.3 specs
- Future `gtih/1.0` may add a façade prefix; v0.1 stays on live Lexiom 1.3 URLs
