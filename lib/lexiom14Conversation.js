/**
 * Lexiom 1.4 — conversational Follow-up over session replica (POC).
 * Happy-path readiness is `generateOsnForSession` (single YAML OSN).
 * postMessage remains for Follow-up; it must not regress a generated OSN.
 */
import crypto from 'crypto';
import {
  bumpStructureRevision,
  emitSessionEvent
} from './lexiom14Sessions.js';

function msg(role, text) {
  return {
    id: 'msg_' + crypto.randomBytes(6).toString('hex'),
    role,
    text,
    created_at: new Date().toISOString()
  };
}

function userTurnCount(session) {
  return session.messages.filter((m) => m.role === 'user').length;
}

function deriveIntent(session) {
  const userTexts = session.messages.filter((m) => m.role === 'user').map((m) => m.text);
  const joined = userTexts.join(' ').trim();
  const label = session.case_label || 'outcome document';
  if (!joined) return `Draft ${label}`;
  const first = userTexts[0] || label;
  return first.length > 160 ? first.slice(0, 157) + '…' : first;
}

/**
 * Advance hemispheres from conversation depth (POC heuristic).
 * @param {object} session
 */
function refreshStructure(session) {
  const turns = userTurnCount(session);
  const intent = deriveIntent(session);
  const outputReady = turns >= 1;
  const evidenceReady = turns >= 2;

  session.structure.nodes = [
    {
      id: 'node_root',
      title: intent,
      kind: 'outcome',
      parent_ids: []
    }
  ];
  if (outputReady) {
    session.structure.nodes.push({
      id: 'node_output',
      title: 'Output specification',
      kind: 'output_spec',
      parent_ids: ['node_root']
    });
  }
  if (evidenceReady) {
    session.structure.nodes.push({
      id: 'node_evidence',
      title: 'Success evidences',
      kind: 'success_evidence',
      parent_ids: ['node_root']
    });
  }

  session.structure.hemispheres = {
    output_spec_ready: outputReady,
    success_evidence_ready: evidenceReady,
    output_spec_summary: outputReady
      ? `Document should realize: ${intent}`
      : '',
    success_evidence_summary: evidenceReady
      ? 'Direct TEXTUAL_SNIPPET from delivered document.md must be reviewable'
      : ''
  };
  bumpStructureRevision(session);

  const ready = outputReady && evidenceReady;
  session.build_readiness = {
    ready,
    reasons: ready
      ? []
      : [
          !outputReady ? 'Describe the desired document outcome' : null,
          !evidenceReady ? 'Confirm how success should be inspected (e.g. a readable excerpt)' : null
        ].filter(Boolean),
    hemispheres: {
      output_spec_ready: outputReady,
      success_evidence_ready: evidenceReady
    }
  };

  emitSessionEvent(session.session_id, 'structureUpdated', {
    structure: session.structure
  });
  emitSessionEvent(session.session_id, 'intentUpdated', { summary: intent });
  emitSessionEvent(session.session_id, 'buildReadinessChanged', {
    readiness: session.build_readiness
  });
}

/**
 * @param {object} session
 * @param {{ text: string, client_message_id?: string }} body
 */
export function postConversationMessage(session, body) {
  const text = String(body.text || '').trim();
  if (!text) {
    const err = new Error('empty_message');
    err.code = 'empty_message';
    throw err;
  }

  const userMessage = msg('user', text);
  session.messages.push(userMessage);
  session.status = 'running';

  emitSessionEvent(session.session_id, 'messageAccepted', {
    client_message_id: body.client_message_id || null,
    message: userMessage
  });

  const turns = userTurnCount(session);
  let assistantText;
  if (turns === 1) {
    assistantText =
      'Understood. What should a human be able to open and inspect to know this document succeeded (for example a specific section or claim that must appear in the delivered markdown)?';
  } else if (turns === 2) {
    assistantText =
      'Both hemispheres look sufficient. You can Realize a document package when ready.';
  } else {
    assistantText =
      'Updated. Structure and readiness reflect the latest conversation. Realize when ready.';
  }

  const assistantMessage = msg('assistant', assistantText);
  session.messages.push(assistantMessage);
  emitSessionEvent(session.session_id, 'questionGenerated', {
    message: assistantMessage
  });

  if (session.osn) {
    session.status = 'accepted';
    return { userMessage, assistantMessage };
  }

  refreshStructure(session);
  session.status = 'accepted';
  return { userMessage, assistantMessage };
}
