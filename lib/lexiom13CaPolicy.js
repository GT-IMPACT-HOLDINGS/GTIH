/**
 * Executor-neutral Lexiom CA policy shared by browser, host, and remote seams.
 * CA secondary name: Hanuman (devotee of Ram / the player; see lexiom13CaNaming.js).
 */
export const DUMMY_OPENAI_API_KEY = 'gt3-agent-broker';

export function primaryArtifactForPlugin(pluginId) {
  return pluginId === 'lexiom13.document_builder' ? 'document.md' : 'index.html';
}
