# Devidence — Main Concepts

A concise map of the Demo Evidence Platform (Devidence / OSNG). For full detail, see the [architecture paradigm](specs/00-architecture-paradigm-evidence-tree.md) and [OSN service design](osn-service/README.md).

---

## 1. Why this exists

AI can create and change systems faster than humans can understand, secure, and approve them. Teams already have tests, logs, tickets, and compliance docs — but they are fragmented. Decision-makers cannot quickly answer:

- Does this work as intended?
- Were security and privacy actually checked?
- Who approved this behavior?
- Can we show a customer what was verified?
- Do we *love* the result — is it right, safe, meaningful, accepted?

**Outcome:** AI-speed creation with human-speed trust. Customers buy **evidence, not promises**.

**Genealogy:** manual review → automated tests → observability → compliance → **structured demos**.

---

## 2. The big idea

Turn demos into **structured evidence** organized as a living graph (the OSNG). Every critical scope is a node where **requirements meet implementation meet proof**, with status rolling up so gaps are visible at every level. AI prepares and analyzes; **humans keep responsibility**.

---

## 3. OSN — Outcome Specification Node

The **OSN** is the single repeating unit of the system. Every node has the same anatomy; types (Product, Epic, Story, Task, Control, …) are a configurable taxonomy, not a different model.

| Facet | Meaning |
| --- | --- |
| **Identity** | Stable id, type, title, version |
| **Relations** | Parents (typed), children (full OSNs), dependencies |
| **Specifications** | Named docs (`description`, `api-contract`, …) with role, audience, content |
| **Success Evidence** | Paired **DoE** (what proof must look like) + **Evidence** (proof after build); one entry is **main** |
| **Layers** | Extra requirement packs attached to an implementation OSN (security, OpenAPI, SLO, …) |
| **Implementation** | Link to code, config, or vendor product (versioned) |
| **Lifecycle** | Where it sits in `spec → develop → demo → approve` |
| **Status** | Own verdict, rolled-up (children), effective (combined), often **by layer** |
| **Approvals** | Sign-offs on Spec, DoE, Evidence, OSN, and layers |
| **Plan & cost** | Optional time and AI token/spend estimates vs actuals |

**Promise of an OSN:** open it and, in under a minute, see what was required, what was shown, what passed or failed, what is missing, and who signed.

---

## 4. OSNG — the OSN Graph

OSNs and their links form the **OSNG**. With one decomposition parent per node it looks like a tree; with multiple parents it is a real graph (e.g. shared service under two products, standards parenting many implementations).

**Rollup rule:** missing lower-level proof degrades the parent. Absence is never silent success.

- **Own status** — this node's own specs / DoEs / evidence (including layers on this node)
- **Rolled-up status** — summary of all children (and dependencies), overall and **by layer**
- **Effective status** — the worse of own and rolled-up

Coverage has two axes: **breadth** (all required children present) and **depth** (branches reach leaves with real evidence).

---

## 5. Specs, DoE, and Evidence

Requirements always start from **named specifications** on the OSN, paired with a **Definition of Evidence (DoE)**.

| Concept | Who authors | When | Role |
| --- | --- | --- | --- |
| **Specification** | Usually human (or import) | Before / during build | What must be true |
| **DoE** | Human | Before proof exists | How success will be proven |
| **Evidence** | System / CI / capture / upload | After implementation | The actual proof |

Evidence media can be video, API traces, logs, reports, documents, links, etc. Every piece of Evidence traces to a DoE; every DoE traces to Spec(s). That chain must never break.

---

## 6. Parents, children, and layers

These are related but not the same:

| Relation | Purpose |
| --- | --- |
| **Decomposition parent** | Delivery hierarchy; child evidence rolls up |
| **`part_of` child** | Implements part of the parent's existing spec (delegated sections) |
| **`extension` child** | Adds new specs/requirements the parent did not define |
| **Requirement parent** | Standards / contract OSN that imposes extra requirements on this node |
| **Layer** | Source OSN *attached* to an implementation OSN so that OSN must satisfy it locally (evidence lives on the implementation node) |
| **Dependency** | Runtime / cross-graph reliance (feeds status, not decomposition) |

**Layer 0** = the OSN itself. **Layers 1..N** = attached packs. Only layers enter code-generation context and must be satisfied on implementation OSNs.

Security is not a separate report — it is typically a **first-class layer** on every approval path.

---

## 7. Lifecycle loop

Every node repeats:

```
spec → develop → demo → approve
```

1. **Spec** — author specifications and DoEs; attach layers  
2. **Develop** — build or delegate to children  
3. **Demo** — supply Evidence (CI, Capture Engine, API, manual upload); AI checks against DoE  
4. **Approve** — humans (by role) decide; approval mints a version  

Bugs and change requests re-enter at **spec** on an isolated branch, then promote only after re-approval.

---

## 8. Status algebra (simplified)

Ordered for rollup (worst wins):

`missing` → `pending` → `failed` → `passed` → `approved`

- Parents reflect the **least-complete** child / dependency, overall and per layer  
- `approved` cannot roll up over missing or failed descendants  
- Workflow state (e.g. “Done”) must not be confused with evidence verdict  

---

## 9. Human approval

AI prepares; people (or company-authorized agents with real user principals) decide.

**What can be approved:** Specification, DoE, Evidence, OSN, Layer.

**Decisions:** `approved` or `change_request` (with comments) — no separate “rejected.”

**Fingerprint freeze:** approvals bind to content fingerprints. Content change invalidates prior approvals; unchanged fingerprints can carry forward across builds/versions. Approvals are per **OSN version**, not per CI build.

**Multi-stakeholder:** many can approve; any can raise a change request. Someone responsible judges when there are “enough” approvals to flip state.

The human question remains: **Do we love it?** — right / safe / meaningful / accepted.

---

## 10. Change, revalidation, versioning

1. Raise bug/change on a node → freeze baseline version  
2. Create a change child / revalidation branch (isolated subtree clone)  
3. Capture, analyze, and approve on the branch  
4. Promote → new **immutable** approved version  
5. Retrospective: what broke, what was revalidated, tokens/time to trust  

Existing approved evidence is never silently overwritten.

---

## 11. Capture Engine (concept)

Manual or CI/CD-driven capture of demos and runtime proof: screen video, UI actions, API calls, logs, network, health, latency, privacy/access checks, etc. — across cloud, desktop, and on-prem. Output becomes Evidence bound to DoEs on OSNs.

---

## 12. Platform surfaces (design intent)

| Surface | Role |
| --- | --- |
| **Demo Tree / OSNG UI** | Navigate hierarchy; see rollup and gaps by layer |
| **Node view** | Specs + DoEs first; own vs children; layers; approvals |
| **Review lens** | Role presets (dev, security, manager, client, …) filter what is shown |
| **OSN Service** | Persistence + REST API for the graph (design-only today) |

**Storage recommendation (service design):** PostgreSQL (system of record), Redis (rollup/nav cache), S3/MinIO (blobs), OpenSearch later for scale-out search.

---

## 13. Non-negotiable principles

1. A node always shows required / proven / missing / who approved — readable in under a minute.  
2. Missing evidence is always visible — never silent success.  
3. Parents reflect rollup of all children (and by layer) plus dependencies.  
4. Integrity chain Spec ↔ DoE ↔ Evidence ↔ Product version never breaks.  
5. Only layers enter codegen context and must be satisfied on implementation OSNs.  
6. Spec/DoE/Evidence approvals are fingerprinted; change invalidates them.  
7. Negative decision is **change request** only.  
8. AI prepares; humans (or accountable agents) decide.  
9. Change is revalidated on a branch and becomes a new immutable version only after approval.  
10. Planning accounts for **time and tokens**, not only calendar effort.

---

## 14. How to read this repo

| Document | What it is |
| --- | --- |
| [README.md](README.md) | Vision, pain, thesis, customer story |
| [specs/00-architecture-paradigm-evidence-tree.md](specs/00-architecture-paradigm-evidence-tree.md) | Full conceptual paradigm |
| [osn-service/plans/01-persistence-design.md](osn-service/plans/01-persistence-design.md) | Data model and storage topology |
| [osn-service/api/openapi.yaml](osn-service/api/openapi.yaml) | REST contract (no implementation yet) |

This collection is **design-first**: the paradigm and contracts define the product; implementation should follow them rather than invent a parallel model.
