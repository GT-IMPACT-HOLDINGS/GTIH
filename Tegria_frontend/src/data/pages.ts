export interface PageSection {
  anchorId?: string;
  heading: string;
  blocks: PageBlock[];
}

export interface PageBlock {
  type: "paragraph" | "labeled" | "list" | "quote";
  label?: string;
  text: string;
}

export interface PageData {
  id: string;
  title: string;
  emoji: string;
  subtitle: string;
  breadcrumb: string[];
  sections: PageSection[];
}

export interface TreeItem {
  id: string;
  label: string;
  type: "folder" | "file" | "task";
  status?: "draft" | "ready" | "approved";
  depth: number;
  parentId?: string;
}

/** Map a GTIH propose envelope into Tegria pages + tree.
 * Day-zero cockpit shows only output_spec + success_evidences (lower cognitive load).
 * seed / thematic_lenses remain on the OSN for Hanuman labor; they are not rendered here.
 */
export function mapOsngEnvelopeToTegria(envelope: {
  root_osn_id?: string;
  nodes?: Array<Record<string, unknown>>;
}): { pages: Record<string, PageData>; tree: TreeItem[]; rootId: string | null } {
  const nodes = Array.isArray(envelope?.nodes) ? envelope.nodes : [];
  const pages: Record<string, PageData> = {};
  const tree: TreeItem[] = [];

  nodes.forEach((raw, index) => {
    const id = String(raw.id || envelope.root_osn_id || `node-${index}`);
    const title = String(raw.title || "Untitled OSN");
    const outputSpec = String(raw.output_spec || "");
    const evidences = Array.isArray(raw.success_evidences)
      ? raw.success_evidences
      : [];

    const evidenceLines = evidences
      .map((e) => {
        const o = e as { evidence_id?: string; kind?: string; inspection_prompt?: string };
        return String(o.inspection_prompt || "").trim();
      })
      .filter(Boolean);

    pages[id] = {
      id,
      title,
      emoji: "🌱",
      subtitle: "OSN draft — outcome & evidence",
      breadcrumb: ["Tegria", "Day zero", title],
      sections: [
        {
          heading: "output_spec",
          blocks: [{ type: "paragraph", text: outputSpec || "(empty)" }],
        },
        {
          heading: "success_evidences",
          blocks: evidenceLines.length
            ? evidenceLines.map((text) => ({ type: "list" as const, text }))
            : [{ type: "paragraph", text: "(none)" }],
        },
      ],
    };

    tree.push({
      id,
      label: title,
      type: "folder",
      status: "draft",
      depth: 0,
    });
  });

  const rootId =
    (envelope.root_osn_id && pages[envelope.root_osn_id]
      ? envelope.root_osn_id
      : tree[0]?.id) || null;

  return { pages, tree, rootId };
}

/** Day-zero starts empty (no Checkout mock). */
export const pages: Record<string, PageData> = {};
