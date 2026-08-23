/**
 * Containerized Agent secondary name: Hanuman.
 * Named for the devotee of Ram (the Lexiom player): crosses workspaces, carries
 * tools, and serves the GT3 LM path without claiming White authority / the throne.
 * Primary technical role remains Containerized Agent; Hanuman is display/story.
 * Wire schemas keep `ca_*`.
 */
export const CA_SECONDARY_NAME = 'Hanuman';

/** Human-facing label (schemas keep `ca_*`). */
export function caDisplayLabel() {
  return `Containerized Agent (${CA_SECONDARY_NAME})`;
}
