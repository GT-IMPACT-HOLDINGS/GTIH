/**
 * Lexiom 1.4 Vertical Integration SDK — public TypeScript contracts
 * API version: lexiom14/1.0
 *
 * Normative for Phase (a). Transport (HTTP/SSE) is described in routes.md;
 * this file is the SDK-facing shape. Prefer interfaces + discriminated unions.
 *
 * @see ../Lexiom_1.4_Vertical_Integration_SDK_TypeScript_Spec.md
 */

export const LEXIOM14_API_VERSION = "lexiom14/1.0" as const;

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Opaque Lexiom capability session (conversation and/or realization scope). */
export type SessionId = string;

/** Opaque provenance identifier for metering and audit linkage. */
export type ProvenanceId = string;

/** Opaque metering / consumption event identifier. */
export type MeteringId = string;

export type ActorKind = "human" | "agent";

/**
 * Hierarchical pseudonymous identity for delegated sessions.
 * GTIH must not require customer legal names or vertical revenue.
 */
export interface PseudonymousIdentity {
  vertical_id: string;
  tenant_pseudonym: string;
  app_id: string;
  env?: string;
  actor_pseudonym: string;
  actor_kind?: ActorKind;
}

/**
 * Short-lived delegated credential issued by the vertical (or its BFF)
 * and presented to GTIH on every Lexiom 1.4 call.
 */
export interface DelegatedCredential {
  /** Bearer token string (JWT or opaque). */
  token: string;
  /** ISO-8601 expiry when known to the client. */
  expires_at?: string;
  /** Scopes granted for this token (e.g. conversation, realization, embed). */
  scopes: Lexiom14Scope[];
  identity: PseudonymousIdentity;
  session_id?: SessionId;
}

export type Lexiom14Scope =
  | "conversation"
  | "realization"
  | "embed"
  | "metering.read";

export interface SdkClientConfig {
  /** Absolute GTIH origin, e.g. http://localhost:8080 — required for separate-origin verticals. */
  baseUrl: string;
  apiVersion?: typeof LEXIOM14_API_VERSION;
  getCredential: () => DelegatedCredential | Promise<DelegatedCredential>;
  /** Optional AbortSignal applied as default cancellation for new commands. */
  signal?: AbortSignal;
}

export interface OperationError {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
  provenance_id?: ProvenanceId;
}

export type OperationStatus =
  | "accepted"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/** Unsubscribe handle returned by event subscriptions. */
export type Unsubscribe = () => void;

export interface EventEnvelope<TType extends string, TPayload> {
  api_version: typeof LEXIOM14_API_VERSION;
  type: TType;
  session_id: SessionId;
  occurred_at: string;
  provenance_id?: ProvenanceId;
  payload: TPayload;
}

// ---------------------------------------------------------------------------
// Structure (vertical-mappable; not Lexiom product chrome)
// ---------------------------------------------------------------------------

/**
 * Public structure summary for progressive disclosure.
 * Field names avoid Lexiom-product branding; verticals may label as
 * Output Specifications / Success Evidences / Outcome Graph in their UX.
 */
export interface StructureHemisphereSummary {
  /** Output-specification hemisphere readiness 0..1 or qualitative. */
  output_spec_ready: boolean;
  output_spec_summary?: string;
  /** Success-evidence hemisphere readiness. */
  success_evidence_ready: boolean;
  success_evidence_summary?: string;
}

export interface StructureNodeSummary {
  id: string;
  title: string;
  kind?: string;
  parent_ids?: string[];
}

export interface StructureSnapshot {
  nodes: StructureNodeSummary[];
  hemispheres: StructureHemisphereSummary;
  /** Opaque replica revision for resume/sync hints. */
  revision: string;
}

export interface BuildReadiness {
  ready: boolean;
  reasons?: string[];
  hemispheres: StructureHemisphereSummary;
}

// ---------------------------------------------------------------------------
// Conversational Intelligence API
// ---------------------------------------------------------------------------

export interface ConversationCreateRequest {
  /** Optional vertical SoR snapshot to seed the session replica. */
  seed_snapshot?: unknown;
  /** Human-readable case hint for the vertical (not GTIH branding). */
  case_label?: string;
}

/** Single-prompt YAML OSN generation (POC happy path). */
export interface GenerateOsnRequest {
  session_id: SessionId;
  /** Human description of the desired outcome. Lexiom owns OSN hemispheres. */
  outcome_description: string;
  client_message_id?: string;
}

export interface GenerateOsnResult {
  structure: StructureSnapshot;
  build_readiness: BuildReadiness;
  /**
   * Opaque YAML snapshot for vertical SoR persist.
   * Verticals must not parse hemispheres from this string to drive UX.
   */
  osn_yaml: string;
}

export interface ConversationResumeRequest {
  session_id: SessionId;
}

export interface ConversationPostMessageRequest {
  session_id: SessionId;
  text: string;
  client_message_id?: string;
}

export interface ConversationState {
  session_id: SessionId;
  messages: ConversationMessage[];
  structure?: StructureSnapshot;
  build_readiness: BuildReadiness;
  status: OperationStatus;
  /** Opaque YAML when generateOsn has succeeded; vertical SoR may store as-is. */
  osn_yaml?: string | null;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  created_at: string;
}

export type ConversationEvent =
  | EventEnvelope<"messageAccepted", { client_message_id?: string; message: ConversationMessage }>
  | EventEnvelope<"questionGenerated", { message: ConversationMessage }>
  | EventEnvelope<"intentUpdated", { summary: string }>
  | EventEnvelope<"structureUpdated", { structure: StructureSnapshot }>
  | EventEnvelope<"buildReadinessChanged", { readiness: BuildReadiness }>
  | EventEnvelope<"warning", { warning: OperationError }>
  | EventEnvelope<"error", { error: OperationError }>;

export interface ConversationClient {
  create(req: ConversationCreateRequest, signal?: AbortSignal): Promise<{ session_id: SessionId }>;
  resume(req: ConversationResumeRequest, signal?: AbortSignal): Promise<ConversationState>;
  /**
   * POC happy path: one outcome description → Lexiom-owned YAML OSN
   * with both hemispheres ready. Does not require postMessage.
   */
  generateOsn(req: GenerateOsnRequest, signal?: AbortSignal): Promise<GenerateOsnResult>;
  /** Follow-up multi-turn; not required for build_readiness after generateOsn. */
  postMessage(req: ConversationPostMessageRequest, signal?: AbortSignal): Promise<void>;
  getState(session_id: SessionId, signal?: AbortSignal): Promise<ConversationState>;
  subscribe(session_id: SessionId, handler: (event: ConversationEvent) => void): Unsubscribe;
}

// ---------------------------------------------------------------------------
// Realization API (MVP profile: document)
// ---------------------------------------------------------------------------

export type RealizationProfile = "document"; // software Follow-up

export interface RealizationStartRequest {
  session_id: SessionId;
  profile: RealizationProfile;
  /** Optional vertical overrides; Lexiom derives structure from replica by default. */
  options?: Record<string, unknown>;
}

export type RealizationRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ArtifactDescriptor {
  artifact_id: string;
  /** MVP: document deliverable. */
  media_kind: "document";
  /** MIME or logical type, e.g. text/markdown. */
  content_type: string;
  /** Fetchable URL on GTIH origin, or inline for small POC payloads. */
  uri?: string;
  inline_text?: string;
  file_name?: string;
}

export type DirectEvidenceKind = "TEXTUAL_SNIPPET" | "SCREEN-SHOT" | "VIDEO-CLIP";

export interface SuccessEvidenceItem {
  evidence_id: string;
  kind: DirectEvidenceKind | string;
  direct: boolean;
  label?: string;
  /** Fetchable artifact for inspection in Evidence Review. */
  uri?: string;
  inline_text?: string;
  /** Structure node this evidence validates, when applicable. */
  structure_node_id?: string;
}

export interface RealizationProvenance {
  provenance_id: ProvenanceId;
  session_id: SessionId;
  profile: RealizationProfile;
  started_at: string;
  completed_at?: string;
  agent_label?: string;
}

export interface RealizationPackage {
  package_id: string;
  status: "completed";
  profile: RealizationProfile;
  artifact: ArtifactDescriptor;
  success_evidences: SuccessEvidenceItem[];
  provenance: RealizationProvenance;
  metering_ids: MeteringId[];
  structure_revision?: string;
}

export type RealizationEvent =
  | EventEnvelope<"realizationStarted", { profile: RealizationProfile; run_status: RealizationRunStatus }>
  | EventEnvelope<"stepStarted", { step_id: string; label: string }>
  | EventEnvelope<"stepProgress", { step_id: string; ratio?: number; message?: string }>
  | EventEnvelope<"stepCompleted", { step_id: string }>
  | EventEnvelope<"evidenceProduced", { evidence: SuccessEvidenceItem }>
  | EventEnvelope<"artifactUpdated", { artifact: ArtifactDescriptor }>
  | EventEnvelope<"realizationCompleted", { package: RealizationPackage }>
  | EventEnvelope<"realizationFailed", { error: OperationError; run_status: "failed" }>;

export interface RealizationClient {
  start(req: RealizationStartRequest, signal?: AbortSignal): Promise<{ realization_id: string }>;
  subscribe(session_id: SessionId, handler: (event: RealizationEvent) => void): Unsubscribe;
  getPackage(session_id: SessionId, signal?: AbortSignal): Promise<RealizationPackage | null>;
}

// ---------------------------------------------------------------------------
// Embedded Experience API
// ---------------------------------------------------------------------------

export interface DesignTokens {
  colors?: Record<string, string>;
  typography?: Record<string, string>;
  spacing?: Record<string, string>;
  radii?: Record<string, string>;
  shadows?: Record<string, string>;
  nodeStyles?: Record<string, unknown>;
}

export type EmbedSurface =
  | "evidence_review"
  | "structure_graph"
  | "cockpit";

export interface EmbedMountOptions {
  session_id: SessionId;
  surface: EmbedSurface;
  container: HTMLElement;
  tokens?: DesignTokens;
  /** Vertical-owned snapshot overlay after Realization Package persist. */
  package?: RealizationPackage;
  structure?: StructureSnapshot;
}

export type EmbedCommand =
  | { type: "setTokens"; tokens: DesignTokens }
  | { type: "setSelection"; id: string | null }
  | { type: "focusNode"; id: string }
  | { type: "setPlane"; plane_id: string }
  | { type: "refresh" }
  | { type: "dispose" };

export type EmbedEvent =
  | EventEnvelope<"selectionChanged", { id: string | null; surface: EmbedSurface }>
  | EventEnvelope<"stateChanged", { surface: EmbedSurface; state: Record<string, unknown> }>
  | EventEnvelope<"itemActivated", { id: string; surface: EmbedSurface }>
  | EventEnvelope<"viewportChanged", { surface: EmbedSurface; viewport: Record<string, unknown> }>
  | EventEnvelope<"dataUpdated", { surface: EmbedSurface }>
  | EventEnvelope<"error", { error: OperationError; surface: EmbedSurface }>;

export interface EmbedHandle {
  command(cmd: EmbedCommand): void;
  subscribe(handler: (event: EmbedEvent) => void): Unsubscribe;
}

export interface EmbedClient {
  mount(options: EmbedMountOptions): EmbedHandle;
}

// ---------------------------------------------------------------------------
// Root SDK facade
// ---------------------------------------------------------------------------

export interface Lexiom14Sdk {
  readonly api_version: typeof LEXIOM14_API_VERSION;
  conversation: ConversationClient;
  realization: RealizationClient;
  embed: EmbedClient;
}

export type Lexiom14Event = ConversationEvent | RealizationEvent | EmbedEvent;
