# Lexiom 1.4 Embedded SaaS — Integration Boundary

## Architectural Principle

Verticals such as **TRH** and **Tegria.ai** shall remain independent applications that own their **brand, user experience, users, business logic, and OSN Graph data**. Lexiom 1.4, operated by **GT Impact Holdings (GTIH)**, shall provide capabilities through a secure embedded-SaaS integration layer.

### Vertical Front End

The vertical application shall:

- Render its own branded portal and workflows.
- Maintain authoritative OSN/OSNG state within the vertical domain.
- Obtain user authorization before invoking delegated capabilities.
- Exchange scoped, revocable credentials with Lexiom.
- Invoke Lexiom APIs/SDK components for OSN manipulation, GT3 reasoning, Build, Evidence, Cockpit, and spatial/temporal/semantic experiences.
- Receive structured results and persist relevant state locally.

### Lexiom 1.4 Embedded SaaS

Lexiom shall:

- Execute requested capabilities without becoming the vertical's system of record.
- Enforce authorization and tenant isolation.
- Return deterministic, machine-readable operation results.
- Record attributable capability usage for metering, billing, IP provenance, and royalty allocation.
- Expose versioned integration contracts so vertical implementations remain decoupled from Lexiom internals.

**Core boundary:** verticals own **context and data**; GTIH supplies, meters, and evolves **capabilities and intellectual-property execution**.

## Normative contracts (Phase a)

Versioned integration contracts for Lexiom 1.4 live under [`contracts/`](contracts/README.md):

- TypeScript SDK surface: [`contracts/lexiom14-api.d.ts`](contracts/lexiom14-api.d.ts)
- Events: [`contracts/events-catalogue.md`](contracts/events-catalogue.md)
- Realization Package: [`contracts/realization-package.md`](contracts/realization-package.md)
- Vertical lifecycle mapping (TRH): [`contracts/trh-lifecycle.md`](contracts/trh-lifecycle.md)
- HTTP/SSE + CORS/COOP: [`contracts/routes.md`](contracts/routes.md)

SDK narrative overview: [`Lexiom_1.4_Vertical_Integration_SDK_TypeScript_Spec.md`](Lexiom_1.4_Vertical_Integration_SDK_TypeScript_Spec.md).
