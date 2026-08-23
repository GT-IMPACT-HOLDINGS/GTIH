# Commercial Service-Consumption and IP-Royalty Architecture

**Technical mapping (this repo):** [`GT3_GTIH_Service_Consumption_Technical_Spec_1_0.md`](GT3_GTIH_Service_Consumption_Technical_Spec_1_0.md) — GTIH services ↔ GT3 / `./public`, with Lexiom 1.3 as the primary vertical consumption path (includes Tegria/Integria dual-vertical commercialization mapping in §2a).

The architecture shall separate the vertical company’s customer-facing commercial activity from GT Impact Holdings’ horizontal software-service and intellectual-property operations. A vertical entity such as Tegria contracts with and invoices its customers, controls its pricing and branding, and remains the authoritative owner and data controller of customer-specific OSNGs, Business-Layer artifacts, and related operational content.

Tegria’s web application may communicate directly with GTIH APIs through delegated, session-scoped credentials. Each credential shall carry a hierarchical pseudonymous identity representing the vertical entity, customer tenant, consuming application or environment, and individual user or automated agent. These identifiers shall remain stable throughout the session but need not create persistent cross-session user profiles. A shared session identifier shall propagate across the complete workflow, including OSNG observation and manipulation, GT3 language-model inference, and build-agent execution.

GTIH shall expose both headless APIs and embeddable, brand-configurable UI components. Headless responses shall use neutral structured formats that Tegria may transform and repackage. Embedded components may inherit Tegria’s visual identity while remaining technically operated by GTIH.

Every successful service operation shall automatically generate a standardized, GTIH-signed consumption event. The event shall contain service, session, pseudonymous identity, consumption measurement, applicable tariff, invoked IP assets, and resulting royalty allocation. GTIH shall receive service-consumption information only—not customer identities, prices, invoices, or vertical-company revenue.

GTIH alone shall maintain the governed service catalogue, tariffs, and royalty-allocation rules within the present scope. Each event shall create an immutable real-time charge and royalty record. Authorized vertical owners shall have real-time read access to their raw usage records and derived allocations, while each IP owner shall see the usage and royalties attributed to their IP.

Operational content may be processed transiently or retained by GTIH according to the applicable commercial terms. The precise placement of the GTIH-controlled metering component shall be determined when the operational request route and trust boundaries are designed.

## Appendix A — Design Recommendations for the Tegria Development Team

Tegria should implement its application as the customer-facing orchestration and branding layer of the system. Its backend should authenticate customers, establish commercial entitlements, and issue short-lived delegated credentials authorizing the browser to invoke defined GTIH services. Each session should receive a unique identifier and a pseudonymous identity hierarchy representing Tegria, the customer tenant, the application environment, and the acting user or automated agent.

The front end should support both GTIH headless APIs and embeddable UI components. API responses should be translated into Tegria terminology, workflows, and visual language without changing their authoritative operational meaning. Embedded components should be isolated through versioned integration contracts and controlled styling interfaces.

Tegria should retain authoritative ownership of customer-specific OSNGs and Business-Layer artifacts. Local records should preserve references to GTIH operation IDs, service-consumption events, and generated artifacts. Tegria must not calculate authoritative royalties independently; instead, it should display GTIH-signed usage and allocation records through read-only administrative views accessible to authorized vertical owners.

## Appendix B — Design Recommendations for the GTIH Development Team

GTIH should implement the horizontal platform as a multi-tenant, policy-enforced service layer exposing versioned APIs and embeddable components for OSNG operations, language-model inference, build-agent execution, artifact storage, and related shared capabilities. Every request should validate the delegated credential, session identifier, pseudonymous identity hierarchy, permitted service scope, and vertical-company entitlement before execution.

Each successful billable operation should atomically generate a signed, immutable consumption event. The event should reference the service catalogue entry, tariff version, measured consumption, relevant IP assets, royalty-allocation rule, session, vertical entity, tenant pseudonym, environment, and acting user or agent. Service execution and metering should share one transactional boundary wherever technically feasible, preventing successful service delivery without corresponding usage registration.

GTIH should maintain real-time, access-controlled views for vertical owners and IP owners. Operational content retention must be policy-driven and configurable per commercial agreement. Interfaces should clearly separate operational content from commercial metering metadata. The service catalogue, tariffs, allocation rules, schemas, and APIs should all be versioned, auditable, and backward-compatible.

## Appendix C — Design Recommendations for the IP Owners’ Development Team

Each IP owner should maintain a machine-readable registry describing the software assets, models, algorithms, workflows, patents, or reusable components made available through GTIH. Every registered asset should receive a stable IP identifier, ownership metadata, version history, licence classification, technical dependencies, and explicit mapping to the GTIH services that invoke or depend upon it.

The IP owner’s development process should produce signed release manifests that allow GTIH to verify the provenance and integrity of each contributed version. These manifests should identify executable packages, source or binary references, model versions, configuration requirements, compatibility constraints, and observable usage units relevant to royalty attribution. The IP owner should not receive customer identities or operational business content unless separately authorized by commercial terms.

IP-owner dashboards and integrations should consume GTIH’s read-only royalty and usage feeds rather than recreate the allocation logic locally. Internal systems may reconcile those records with ownership ledgers and expected royalty rules. Technical changes affecting attribution, service compatibility, or measurable consumption must be communicated through versioned metadata before deployment.

