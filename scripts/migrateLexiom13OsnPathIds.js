/**
 * One-shot migration: file-stem path + unique suffix IDs.
 * id === file_name === "{Path.Stems}.{uid8}.osn"
 * Renames *.osn.yaml / *.tomb.osn.yaml and evidence artifacts accordingly.
 */
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { serializeLexiom13OsnYaml } from '../lib/lexiom13OsnPersist.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OSN_DIR = path.join(__dirname, '..', 'public', 'gt2', 'Lexiom_1_3');
const EVIDENCE_DIR = path.join(OSN_DIR, 'evidences');

/** Deterministic migration map: old identity → new path+uid identity */
const MIGRATION = [
  {
    oldId: 'GT_Philosophy.osn',
    alsoOldIds: ['osn.standard.gt_constellation_software_philosophy'],
    oldFileStem: 'GT_Philosophy',
    newId: 'GT_Philosophy.a1000001.osn',
    isTomb: false,
  },
  {
    oldId: 'osn.product.welcome_spa',
    alsoOldIds: ['ProductLexiom.osn'],
    oldFileStem: 'ProductLexiom',
    alsoEvidenceStems: ['ProductWelcome', 'ProductLexiom'],
    newId: 'GT_Philosophy.ProductLexiom.a1000002.osn',
    isTomb: false,
  },
  {
    oldId: 'osn.ux.welcome_spa',
    alsoOldIds: ['UX.osn'],
    oldFileStem: 'UX',
    newId: 'GT_Philosophy.ProductLexiom.UX.a1000003.osn',
    isTomb: false,
  },
  {
    oldId: 'osn.code_shape.welcome_spa',
    alsoOldIds: ['CodeShape.osn'],
    oldFileStem: 'CodeShape',
    newId: 'GT_Philosophy.ProductLexiom.CodeShape.a1000004.osn',
    isTomb: false,
  },
  {
    oldId: 'NewBranch_1.osn',
    alsoOldIds: ['osn.draft.bc891f19'],
    oldFileStem: 'NewBranch_1',
    newId: 'GT_Philosophy.ProductLexiom.CodeShape.NewBranch_1.a1000005.osn',
    isTomb: false,
    preferLive: true,
  },
  {
    oldId: 'NewBranch_1.osn',
    alsoOldIds: ['osn.draft.bc891f19'],
    oldFileStem: 'NewBranch_1',
    newId: 'GT_Philosophy.ProductLexiom.CodeShape.NewBranch_1.a1000006.osn',
    isTomb: true,
  },
];

function serializeOsnYaml(osn) {
  return serializeLexiom13OsnYaml(osn);
}

function remapId(value, idMap) {
  if (typeof value !== 'string') return value;
  return idMap.get(value) || value;
}

function remapGraphLists(osn, idMap) {
  if (!osn.graph || typeof osn.graph !== 'object') return;
  for (const key of ['parent_osn_ids', 'child_osn_ids', 'standard_ancestor_osn_ids']) {
    if (!Array.isArray(osn.graph[key])) continue;
    osn.graph[key] = osn.graph[key].map((id) => remapId(id, idMap));
  }
  if (osn.graph.tombstone && osn.graph.tombstone.prune_root) {
    osn.graph.tombstone.prune_root = remapId(osn.graph.tombstone.prune_root, idMap);
  }
}

async function pathExists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const idMap = new Map();
  for (const entry of MIGRATION) {
    idMap.set(entry.oldId, entry.newId);
    for (const alt of entry.alsoOldIds || []) {
      // Tomb vs live both map from NewBranch_1.osn — handle per-file below.
      if (alt === 'NewBranch_1.osn' || entry.oldId === 'NewBranch_1.osn') continue;
      idMap.set(alt, entry.newId);
    }
  }
  // Global remaps for graph links (live NewBranch preferred for CodeShape child list)
  idMap.set('osn.standard.gt_constellation_software_philosophy', 'GT_Philosophy.a1000001.osn');
  idMap.set('GT_Philosophy.osn', 'GT_Philosophy.a1000001.osn');
  idMap.set('osn.product.welcome_spa', 'GT_Philosophy.ProductLexiom.a1000002.osn');
  idMap.set('ProductLexiom.osn', 'GT_Philosophy.ProductLexiom.a1000002.osn');
  idMap.set('osn.ux.welcome_spa', 'GT_Philosophy.ProductLexiom.UX.a1000003.osn');
  idMap.set('UX.osn', 'GT_Philosophy.ProductLexiom.UX.a1000003.osn');
  idMap.set('osn.code_shape.welcome_spa', 'GT_Philosophy.ProductLexiom.CodeShape.a1000004.osn');
  idMap.set('CodeShape.osn', 'GT_Philosophy.ProductLexiom.CodeShape.a1000004.osn');

  const results = [];

  for (const entry of MIGRATION) {
    const oldYaml = entry.isTomb
      ? `${entry.oldFileStem}.tomb.osn.yaml`
      : `${entry.oldFileStem}.osn.yaml`;
    const newYaml = entry.isTomb
      ? `${entry.newId.replace(/\.osn$/, '')}.tomb.osn.yaml`
      : `${entry.newId}.yaml`;

    const oldPath = path.join(OSN_DIR, oldYaml);
    if (!(await pathExists(oldPath))) {
      console.warn('skip missing', oldYaml);
      continue;
    }

    const raw = await fsp.readFile(oldPath, 'utf8');
    const osn = yaml.load(raw);
    if (!osn || typeof osn !== 'object') {
      throw new Error(`Invalid YAML: ${oldYaml}`);
    }

    const fileIdMap = new Map(idMap);
    if (entry.isTomb) {
      fileIdMap.set('NewBranch_1.osn', entry.newId);
      fileIdMap.set('osn.draft.bc891f19', entry.newId);
    } else if (entry.preferLive) {
      fileIdMap.set('NewBranch_1.osn', entry.newId);
      fileIdMap.set('osn.draft.bc891f19', entry.newId);
    }

    osn.id = entry.newId;
    osn.file_name = entry.newId;
    remapGraphLists(osn, fileIdMap);

    // Ensure live CodeShape lists live NewBranch child after remap.
    if (entry.newId === 'GT_Philosophy.ProductLexiom.CodeShape.a1000004.osn') {
      if (!Array.isArray(osn.graph.child_osn_ids)) osn.graph.child_osn_ids = [];
      const liveChild = 'GT_Philosophy.ProductLexiom.CodeShape.NewBranch_1.a1000005.osn';
      if (!osn.graph.child_osn_ids.includes(liveChild)) {
        osn.graph.child_osn_ids.push(liveChild);
      }
    }

    const newPath = path.join(OSN_DIR, newYaml);
    await fsp.writeFile(newPath, serializeOsnYaml(osn), 'utf8');
    if (path.resolve(oldPath) !== path.resolve(newPath)) {
      await fsp.unlink(oldPath);
    }
    results.push({ oldYaml, newYaml, id: entry.newId });
  }

  // Rename evidence artifacts: {oldStem}.osn.sev... → {newId}.sev...
  // newId already ends with .osn, evidence pattern is {file_name}.{evidence_id}...
  const evidenceNames = await fsp.readdir(EVIDENCE_DIR);
  for (const entry of MIGRATION) {
    if (entry.isTomb) continue;
    const stems = [entry.oldFileStem, ...(entry.alsoEvidenceStems || [])];
    for (const stem of stems) {
      const prefix = `${stem}.osn.`;
      for (const name of evidenceNames) {
        if (!name.startsWith(prefix)) continue;
        const rest = name.slice(prefix.length);
        const newName = `${entry.newId}.${rest}`;
        const from = path.join(EVIDENCE_DIR, name);
        const to = path.join(EVIDENCE_DIR, newName);
        if (!(await pathExists(from))) continue;
        if (await pathExists(to)) {
          console.warn('evidence target exists, skip', newName);
          continue;
        }
        await fsp.rename(from, to);
        console.log('evidence', name, '→', newName);
      }
    }
  }

  console.log(JSON.stringify({ migrated: results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
