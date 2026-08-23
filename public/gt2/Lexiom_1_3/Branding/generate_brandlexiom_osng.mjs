import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { serializeLexiom13OsnYaml } from '../../../../lib/lexiom13OsnPersist.js';

const OUTPUT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PARENT_ID = 'GT_Philosophy.a1000001.osn';
const FIRST_UID = 5;

function node(name, title, profession, sections, mandate, deliverable, children = []) {
  return { name, title, profession, sections, mandate, deliverable, children };
}

const brandTree = node(
  'BrandLexiom',
  'Lexiom 1.3 — Ogun Brand',
  'Brand Leadership',
  '§§1–2 and §§24–28',
  'Govern the complete enterprise brand for Lexiom 1.3 — Ogun as the service that turns human intention into governed, inspectable, evidence-backed outcomes.',
  'an approved Ogun brand standard and executive brand brief',
  [
    node(
      'BrandStrategy',
      'Ogun Brand Strategy',
      'Brand Strategy',
      '§§2, 4–10, 15, and 20',
      'Define the market meaning, category, audiences, value, and defensible claims that keep Ogun commercially coherent.',
      'an approved brand strategy deck',
      [
        node(
          'MarketPositioning',
          'Market Positioning',
          'Positioning Strategy',
          '§§4, 9, and 15',
          'Position Ogun as the Outcome Governance and Semantic Relationship Operating System without collapsing it into a narrower software category.',
          'an approved positioning framework',
          [
            node(
              'CategoryDefinition',
              'Category Definition',
              'Category Design',
              '§4',
              'Establish the primary commercial category and its supporting technical vocabulary for business and technical audiences.',
              'an approved category-definition brief',
              [
                node(
                  'PrimaryCategory',
                  'Primary Commercial Category',
                  'Category Strategy',
                  '§§4.1 and 4.3',
                  'Lead consistently with Outcome Governance and Semantic Relationship Operating System and explain the organizational value carried by that category.',
                  'a reviewed primary-category statement',
                  [
                    node(
                      'CategoryStatement',
                      'Canonical Category Statement',
                      'Brand Positioning',
                      '§§4.1 and 4.3',
                      'Produce a concise canonical category statement that connects intentions, standards, governed outcome graphs, human authority, and evidence.',
                      'an approved canonical category statement'
                    ),
                    node(
                      'CategoryEducation',
                      'Category Education',
                      'Market Education',
                      '§§4.1 and 17.3',
                      'Teach prospects what outcome governance and semantic relationship management mean without relying on unexplained product jargon.',
                      'a published category-education explainer'
                    ),
                  ]
                ),
                node(
                  'TechnicalCategories',
                  'Supporting Technical Categories',
                  'Technical Marketing',
                  '§4.2',
                  'Use technical descriptors to clarify architecture for technical, investor, security, and architecture audiences without displacing the primary category.',
                  'an approved technical-positioning brief',
                  [
                    node(
                      'DeterministicSemanticOS',
                      'Deterministic Semantic Operating System',
                      'Architecture Marketing',
                      '§§4.2 and 9.3',
                      'Explain Ogun as the deterministic semantic control layer between probabilistic generation and canonical enterprise state.',
                      'a reviewed technical architecture narrative'
                    ),
                    node(
                      'GovernedAgentLifecycle',
                      'Governed Agent Lifecycle Infrastructure',
                      'AI Governance Marketing',
                      '§§4.2, 6.3, and 9.3',
                      'Explain how agents may propose and assist while explicit human actions retain authority over commitments, evidence, and canonical state.',
                      'an approved governed-agent lifecycle explainer'
                    ),
                  ]
                ),
              ]
            ),
            node(
              'CompetitiveDifferentiation',
              'Competitive Differentiation',
              'Competitive Strategy',
              '§15',
              'Differentiate Ogun by the meaning, authority, lineage, inheritance, and evidence it governs rather than by feature-list comparison.',
              'an approved competitive differentiation matrix',
              [
                node(
                  'RecordSystemsContrast',
                  'Record and Work Systems Contrast',
                  'Competitive Intelligence',
                  '§§15.1–15.2 and 15.7',
                  'Contrast Ogun with CRM, project management, and requirements systems while respecting the strengths and proper role of each.',
                  'a reviewed record-systems comparison',
                  [
                    node(
                      'CrmContrast',
                      'CRM Contrast',
                      'CRM Market Analysis',
                      '§15.1',
                      'Show that CRM records commercial relationships while Ogun governs their intended outcomes and evolving meaning.',
                      'an approved CRM-versus-Ogun comparison'
                    ),
                    node(
                      'ProjectRequirementsContrast',
                      'Project and Requirements Contrast',
                      'Work Management Analysis',
                      '§§15.2 and 15.7',
                      'Show that work and requirements tools track activity or specifications while Ogun governs why work exists and what proves success.',
                      'an approved project-and-requirements comparison'
                    ),
                  ]
                ),
                node(
                  'AIPlatformContrast',
                  'AI Platform Contrast',
                  'AI Market Intelligence',
                  '§§15.3–15.6',
                  'Distinguish Ogun from AI governance, observability, orchestration, and coding tools through its control of authority, outcome meaning, and evidence.',
                  'a reviewed AI-platform comparison',
                  [
                    node(
                      'GovernanceObservabilityContrast',
                      'AI Governance and Observability Contrast',
                      'AI Governance Analysis',
                      '§§15.3–15.4',
                      'Explain that Ogun binds approval and inherited standards into active execution rather than only documenting or observing AI behavior.',
                      'an approved governance-and-observability comparison'
                    ),
                    node(
                      'AgentCodingContrast',
                      'Agent Orchestration and Coding Contrast',
                      'Agent Platform Analysis',
                      '§§15.5–15.6',
                      'Explain that Ogun governs the outcome graph that authorizes and validates execution rather than merely coordinating agents or generating code.',
                      'an approved agent-and-coding comparison'
                    ),
                  ]
                ),
              ]
            ),
          ]
        ),
        node(
          'AudienceValue',
          'Audience and Enterprise Value',
          'Market Strategy',
          '§§5, 7, and 8',
          'Connect Ogun’s governed cooperation model to the sectors, roles, concerns, and measurable business effects that create enterprise demand.',
          'an approved audience-and-value strategy',
          [
            node(
              'CustomerProfiles',
              'Ideal Customer Profiles',
              'Customer Strategy',
              '§8',
              'Define priority organizations, sectors, and buying roles while preserving Ogun’s cross-domain identity.',
              'an approved ideal-customer profile pack',
              [
                node(
                  'PrioritySectors',
                  'Priority Sectors',
                  'Vertical Market Strategy',
                  '§§8.1–8.2',
                  'Prioritize consequential, multidisciplinary environments with costly misunderstanding, AI-assisted processes, and evidence obligations.',
                  'an approved priority-sector portfolio',
                  [
                    node(
                      'RegulatedSectors',
                      'Regulated Sectors',
                      'Regulated Industry Marketing',
                      '§8.2',
                      'Adapt the Ogun narrative for financial services, healthcare, government, legal services, and regulated manufacturing without making unsupported compliance claims.',
                      'a reviewed regulated-sector solution brief'
                    ),
                    node(
                      'EnterpriseDeliverySectors',
                      'Enterprise Delivery Sectors',
                      'Enterprise Market Development',
                      '§§5.5 and 8.2',
                      'Adapt the narrative for enterprise software, professional services, systems integration, procurement, construction, and telecommunications.',
                      'a reviewed enterprise-delivery solution brief'
                    ),
                  ]
                ),
                node(
                  'BuyingCommittee',
                  'Buying Committee',
                  'Buying-Center Strategy',
                  '§8.3',
                  'Equip economic buyers, champions, and evaluators with role-specific value and proof while preserving one coherent product truth.',
                  'an approved buying-committee map',
                  [
                    node(
                      'EconomicBuyers',
                      'Economic Buyers',
                      'Executive Marketing',
                      '§8.3',
                      'Address executive concerns about failed outcomes, uncontrolled AI, delivery risk, rework, accountability, and portfolio visibility.',
                      'a reviewed executive buyer brief'
                    ),
                    node(
                      'ChampionsEvaluators',
                      'Champions and Evaluators',
                      'Technical Buyer Marketing',
                      '§8.3',
                      'Address champion and evaluator concerns about alignment, ambiguity, handoffs, proving completion, security, legal, compliance, and operations.',
                      'a reviewed champion-and-evaluator brief'
                    ),
                  ]
                ),
              ]
            ),
            node(
              'ValueProposition',
              'Enterprise Value Proposition',
              'Value Proposition Design',
              '§§5 and 7',
              'Translate Ogun’s semantic governance into credible effects for alignment, governed AI adoption, evidence-backed delivery, continuity, and economic intelligence.',
              'an approved enterprise value proposition',
              [
                node(
                  'EnterprisePillars',
                  'Enterprise Value Pillars',
                  'Enterprise Value Strategy',
                  '§7',
                  'Organize Ogun’s value around alignment, governed AI adoption, evidence-backed delivery, relationship continuity, and economic intelligence.',
                  'a reviewed enterprise value-pillar deck',
                  [
                    node(
                      'AlignmentGovernedAI',
                      'Alignment and Governed AI',
                      'AI Transformation Strategy',
                      '§§7.1A–7.1B',
                      'Show how explicit ownership and approval reduce ambiguity and unauthorized drift while enabling faster AI-assisted work.',
                      'an approved alignment-and-governed-AI case narrative'
                    ),
                    node(
                      'EvidenceEconomics',
                      'Evidence and Economic Intelligence',
                      'Value Engineering',
                      '§§7.1C–7.1E',
                      'Show how direct evidence, relationship continuity, and graph-garden intelligence improve confidence and resource allocation.',
                      'a reviewed evidence-and-economics value model'
                    ),
                  ]
                ),
                node(
                  'XrmNarrative',
                  'XRM Narrative',
                  'Relationship Strategy',
                  '§5',
                  'Position XRM as CRM determinism plus semantic relationship probabilisticity governed by human approval and evidence.',
                  'an approved XRM narrative',
                  [
                    node(
                      'SrmDefinition',
                      'Semantic Relationship Management',
                      'Relationship Management Strategy',
                      '§5.2',
                      'Define SRM as management of evolving intentions, interpretations, commitments, risks, dependencies, evidence, and context.',
                      'a published SRM explainer'
                    ),
                    node(
                      'XrmPositioning',
                      'XRM Positioning',
                      'XRM Category Strategy',
                      '§§5.3–5.5 and 9.4',
                      'Show how Ogun extends relationship systems from stable records to governed outcome relationships across organizations.',
                      'an approved XRM positioning brief'
                    ),
                  ]
                ),
              ]
            ),
          ]
        ),
      ]
    ),
    node(
      'BrandExpression',
      'Ogun Brand Expression',
      'Brand Experience',
      '§§3, 10–14, 16–19, and 22–23',
      'Translate strategy into coherent names, language, visual identity, product experience, campaigns, sales materials, and measurable market activation.',
      'an approved integrated brand-expression system',
      [
        node(
          'CreativeIdentity',
          'Creative Identity',
          'Creative Direction',
          '§§3 and 10–13',
          'Express Ogun through disciplined verbal and visual systems that feel strong, calm, human-governed, and technically credible.',
          'an approved creative identity system',
          [
            node(
              'VerbalIdentity',
              'Verbal Identity',
              'Verbal Brand Strategy',
              '§§3 and 10–12',
              'Govern naming, message hierarchy, taglines, personality, and voice so every expression remains clear and evidence-aware.',
              'an approved verbal identity guide',
              [
                node(
                  'NamingArchitecture',
                  'Naming Architecture',
                  'Brand Architecture',
                  '§3',
                  'Keep Lexiom, Lexiom 1.3, Ogun, Lexiom Cockpit, Ogun Portal, OSN Graph Garden, and Demo Evidence in one coherent hierarchy.',
                  'an approved naming architecture',
                  [
                    node(
                      'MasterNaming',
                      'Master Naming Structure',
                      'Naming Strategy',
                      '§3.1',
                      'Standardize first and subsequent mentions and prevent Ogun from appearing as an unrelated product separate from Lexiom.',
                      'a reviewed naming standards sheet'
                    ),
                    node(
                      'NamingRationale',
                      'Ogun Naming Rationale',
                      'Brand Narrative',
                      '§§3.2–3.3',
                      'Use the governed-forge metaphor to evoke disciplined toolmaking and accountable transformation without mysticism or aggression.',
                      'an approved naming-rationale narrative'
                    ),
                  ]
                ),
                node(
                  'MessagingVoice',
                  'Messaging and Voice',
                  'Brand Copy Direction',
                  '§§10–12',
                  'Apply the message hierarchy, tagline system, personality, and voice consistently from promise through technical proof.',
                  'an approved messaging and voice guide',
                  [
                    node(
                      'TaglineSystem',
                      'Tagline System',
                      'Campaign Copywriting',
                      '§§10–11',
                      'Lead with “Govern what must become real” and select supporting or campaign lines according to audience and proof context.',
                      'a reviewed tagline and campaign-line library'
                    ),
                    node(
                      'ToneOfVoice',
                      'Tone of Voice',
                      'Editorial Direction',
                      '§12',
                      'Use declarative clarity, active verbs, restrained metaphor, and human language while avoiding hype and probabilistic claims presented as fact.',
                      'an approved tone-of-voice guide'
                    ),
                  ]
                ),
              ]
            ),
            node(
              'VisualIdentity',
              'Visual Identity',
              'Visual Design Direction',
              '§13',
              'Create an accessible visual system for the governed forge and living graph whose states communicate authority, proposals, evidence, and conflict.',
              'an approved visual identity board',
              [
                node(
                  'VisualLanguage',
                  'Visual Language',
                  'Brand Design',
                  '§§13.1–13.3',
                  'Define core forms, avoided motifs, and semantic color principles for disciplined pathways, inheritance, evidence, and state.',
                  'a reviewed visual-language board',
                  [
                    node(
                      'CoreMetaphor',
                      'Core Visual Metaphor',
                      'Concept Design',
                      '§§13.1–13.2',
                      'Express the governed forge and living graph through structured nodes, convergence, seeds, layers, anchors, and lineage without cliché or appropriation.',
                      'an approved core-metaphor concept board'
                    ),
                    node(
                      'ColorPrinciples',
                      'Semantic Color Principles',
                      'Color and Accessibility Design',
                      '§13.3',
                      'Distinguish approved, proposed, stable, conflict, missing-evidence, achieved, inherited, and overridden states with accessible contrast.',
                      'an accessibility-reviewed semantic palette'
                    ),
                  ]
                ),
                node(
                  'TypographyMotion',
                  'Typography and Motion',
                  'Interaction Brand Design',
                  '§§13.4–13.5',
                  'Use architectural readability and restrained state-transition motion to reinforce credibility and governance.',
                  'an approved typography-and-motion system',
                  [
                    node(
                      'Typography',
                      'Typography',
                      'Typography Design',
                      '§13.4',
                      'Specify spacious headings, highly legible body text, and restrained monospace for identifiers and provenance without pseudo-futuristic distortion.',
                      'an accessibility-reviewed typographic specimen'
                    ),
                    node(
                      'Motion',
                      'Motion',
                      'Motion Design',
                      '§13.5',
                      'Animate proposals, White Move anchoring, lineage inspection, and evidence closure as meaningful state transitions rather than decoration.',
                      'a reviewed motion prototype reel'
                    ),
                  ]
                ),
              ]
            ),
          ]
        ),
        node(
          'GoToMarket',
          'Go-to-Market System',
          'Go-to-Market Leadership',
          '§§14 and 16–19 and 22–23',
          'Turn the Ogun brand into product proof, demand, sales enablement, packaging, pilots, and measurable commercial learning.',
          'an approved go-to-market plan',
          [
            node(
              'DemandGeneration',
              'Demand Generation',
              'Demand Generation Strategy',
              '§§17 and 19',
              'Build website and educational content journeys that teach the category, demonstrate governed cooperation, and invite consequential use cases.',
              'a reviewed demand-generation campaign',
              [
                node(
                  'WebsiteExperience',
                  'Website Experience',
                  'Digital Experience Strategy',
                  '§17',
                  'Sequence the website from promise and market gap through the Ogun model, XRM, governed AI, value, proof, and a consequential-workflow call to action.',
                  'a reviewable website prototype',
                  [
                    node(
                      'HomepageSequence',
                      'Homepage Sequence',
                      'Web Content Design',
                      '§17.1',
                      'Deliver the prescribed homepage sequence with “Govern what must become real,” clear category explanation, product model, proof, and calls to action.',
                      'a rendered homepage prototype'
                    ),
                    node(
                      'SolutionPages',
                      'Solution and Education Pages',
                      'Solution Marketing',
                      '§§17.2–17.3',
                      'Deliver solution and educational pages for priority use cases and foundational concepts such as OSNs, SRM, evidence, inheritance, and human authority.',
                      'a reviewed solution-page collection'
                    ),
                  ]
                ),
                node(
                  'ContentStrategy',
                  'Content Strategy',
                  'Content Marketing Strategy',
                  '§19',
                  'Educate the market through durable pillars and flagship assets centered on authority, outcomes, relationships, evidence, economics, and disciplined toolmaking.',
                  'an approved editorial strategy',
                  [
                    node(
                      'ContentPillars',
                      'Content Pillars',
                      'Editorial Strategy',
                      '§19.1',
                      'Maintain the ten core content pillars as a balanced editorial system spanning human authority, XRM, evidence, standards, cooperation, and accountable execution.',
                      'a reviewed editorial pillar calendar'
                    ),
                    node(
                      'FlagshipAssets',
                      'Flagship Assets',
                      'Thought Leadership',
                      '§19.2',
                      'Produce the manifesto, SRM case, human-authority argument, evidence narrative, executive guide, interactive proof, and assessment assets.',
                      'a published flagship thought-leadership asset'
                    ),
                  ]
                ),
              ]
            ),
            node(
              'SalesEnablement',
              'Sales Enablement',
              'Revenue Enablement',
              '§§16 and 18',
              'Equip commercial teams to discover consequential workflows, demonstrate governed outcomes, package value, and frame credible pilots.',
              'an approved sales enablement kit',
              [
                node(
                  'SalesNarrative',
                  'Sales Narrative',
                  'Enterprise Sales Strategy',
                  '§18',
                  'Guide discovery, demonstration, and proof language so sales makes proposal, approval, evidence, inheritance, and unresolved conflict visible.',
                  'a reviewed enterprise sales playbook',
                  [
                    node(
                      'DiscoveryQuestions',
                      'Discovery Questions',
                      'Enterprise Discovery',
                      '§18.1',
                      'Use questions that reveal ambiguity, interdependence, AI-to-commitment boundaries, approval gaps, evidence needs, standards loss, and hidden disagreement.',
                      'a field-tested discovery guide'
                    ),
                    node(
                      'DemonstrationArc',
                      'Demonstration and Proof Arc',
                      'Solution Consulting',
                      '§§18.2–18.3',
                      'Demonstrate the journey from raw intention through OSNs, disciplines, conflict, approval, execution, direct inspection, lineage, and executive analysis.',
                      'a recorded end-to-end Ogun demonstration'
                    ),
                  ]
                ),
                node(
                  'ServicePackaging',
                  'Service Packaging',
                  'Commercial Packaging',
                  '§16',
                  'Package Ogun around enterprise governance value, participation scope, policy and evidence depth, and consequential pilots rather than seat utility or token consumption.',
                  'an approved commercial packaging brief',
                  [
                    node(
                      'PackagingTiers',
                      'Packaging Tiers',
                      'Offer Design',
                      '§16.1',
                      'Define Foundation, Enterprise, and Ecosystem offers by governance scope, graph gardens, inheritance, participation, analytics, and strategic services.',
                      'a reviewed offer-tier comparison'
                    ),
                    node(
                      'PricingPilot',
                      'Pricing and Pilot Framing',
                      'Commercial Strategy',
                      '§§16.2–16.3',
                      'Price against avoided rework, governed risk, acceptance, accountability, and reuse, and frame pilots around real multidisciplinary workflows with direct evidence.',
                      'an approved pricing hypothesis and pilot offer'
                    ),
                  ]
                ),
              ]
            ),
          ]
        ),
      ]
    ),
  ]
);

function flattenBreadthFirst(root) {
  const queue = [{ definition: root, parent: null, depth: 0, pathNames: [root.name] }];
  const flattened = [];
  while (queue.length) {
    const current = queue.shift();
    flattened.push(current);
    for (const child of current.definition.children) {
      queue.push({
        definition: child,
        parent: current,
        depth: current.depth + 1,
        pathNames: [...current.pathNames, child.name],
      });
    }
  }
  return flattened;
}

function slug(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

const flattened = flattenBreadthFirst(brandTree);
if (flattened.length !== 63) {
  throw new Error(`Expected 63 BrandLexiom nodes, received ${flattened.length}`);
}

for (const item of flattened) {
  const expectedChildren = item.depth < 5 ? 2 : 0;
  if (item.definition.children.length !== expectedChildren) {
    throw new Error(
      `${item.definition.name} at depth ${item.depth} must have ${expectedChildren} children`
    );
  }
}

flattened.forEach((item, index) => {
  item.uid = `a100${String(FIRST_UID + index).padStart(4, '0')}`;
  item.id = `GT_Philosophy.${item.pathNames.join('.')}.${item.uid}.osn`;
});

const itemByDefinition = new Map(flattened.map((item) => [item.definition, item]));

function createOsn(item) {
  const { definition } = item;
  const parentItem = item.parent ? itemByDefinition.get(item.parent.definition) : null;
  const nodeSlug = slug(definition.name);
  const parentSlug = parentItem ? slug(parentItem.definition.name) : null;
  const childIds = definition.children.map((child) => itemByDefinition.get(child).id);

  return {
    schema_version: 'osn/0.2',
    id: item.id,
    file_name: item.id,
    node_type: item.depth === 0 ? 'product' : 'discipline',
    ...(item.depth === 0 ? {} : { discipline: definition.profession }),
    title: definition.title,
    owner: {
      owner_id: 'dror',
      display_name: 'Dror Levin',
      role: `${definition.profession} OSN Owner`,
    },
    graph: {
      parent_osn_ids: [parentItem ? parentItem.id : ROOT_PARENT_ID],
      child_osn_ids: childIds,
      standard_ancestor_osn_ids: [],
      derived_from_lens_id: parentSlug
        ? `lens.brand.${parentSlug}.professional_craft`
        : 'lens.constellation.value_flow',
    },
    source_spec: {
      document: 'Branding/branding_spec.md',
      sections: definition.sections,
    },
    seed: definition.mandate,
    thematic_lenses: [
      {
        lens_id: `lens.brand.${nodeSlug}.professional_craft`,
        name: definition.profession,
        purpose: `Apply ${definition.profession.toLowerCase()} judgment to this outcome.`,
      },
      {
        lens_id: `lens.brand.${nodeSlug}.human_authority`,
        name: 'Human Authority',
        purpose: 'Keep proposals distinct from approved organizational truth.',
      },
      {
        lens_id: `lens.brand.${nodeSlug}.evidence`,
        name: 'Evidence and Claims',
        purpose: 'Require inspectable delivery and classify claims according to available proof.',
      },
    ],
    output_spec:
      [
      `Produce and govern ${definition.deliverable}.`,
      '',
      `Source scope: ${definition.sections} of Branding/branding_spec.md.`,
      '',
      `Outcome requirements:`,
      `- ${definition.mandate}`,
      '- Preserve Ogun’s primary category, human-governed authority model, and evidence-backed promise.',
      '- Treat AI-generated interpretation and copy as proposals until an authorized human approves them.',
      '- Classify capability, market, regulatory, numerical, and performance claims; do not publish unsupported certainty.',
      '- Keep the result concrete, commercially usable, accessible to its audience, and consistent with ancestor OSNs.',
      ].join('\n') + '\n',
    success_evidences: [
      {
        evidence_id: `sev.brand.${nodeSlug}.delivered_artifact`,
        kind: 'direct_document_review',
        direct: true,
        inspection_prompt:
          `Open and inspect the delivered outcome artifact (${definition.deliverable}). Confirm that it fulfills this node’s ` +
          `mandate, matches the approved ancestor brand direction, distinguishes proposals from approved ` +
          `claims, and contains no unsupported certainty. Review the delivered artifact itself, not this OSN.`,
      },
    ],
    compilation: {
      can_be_compilation_root: false,
      compilation_scope: 'self_only',
      target_tool_profile: null,
    },
  };
}

const generatedFilePattern =
  /^GT_Philosophy\.BrandLexiom(?:\.[A-Za-z0-9_-]+)*\.a100\d{4}\.osn\.yaml$/;
for (const entry of await fsp.readdir(OUTPUT_DIR, { withFileTypes: true })) {
  if (entry.isFile() && generatedFilePattern.test(entry.name)) {
    await fsp.unlink(path.join(OUTPUT_DIR, entry.name));
  }
}

for (const item of flattened) {
  const fileName = `${item.id}.yaml`;
  await fsp.writeFile(
    path.join(OUTPUT_DIR, fileName),
    serializeLexiom13OsnYaml(createOsn(item)),
    'utf8'
  );
}

console.log(`Generated ${flattened.length} BrandLexiom OSNs in ${OUTPUT_DIR}`);
