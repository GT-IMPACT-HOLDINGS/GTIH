import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(
  path.join(__dirname, 'lexiom-narrative-contract.json'),
  'utf-8'
);
export const lexiomNarrativeContract = JSON.parse(raw);
export const LEXIOM_NARRATIVE_CONTRACT_VERSION =
  typeof lexiomNarrativeContract.version === 'number'
    ? lexiomNarrativeContract.version
    : 1;
