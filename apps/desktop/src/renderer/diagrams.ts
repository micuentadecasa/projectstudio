export type DiagramNode = { id: string; label: string };
export type DiagramEdge = { from: string; to: string };
export type MermaidDiagram = { nodes: DiagramNode[]; edges: DiagramEdge[] };

const fencedMermaid = /```mermaid\s*\n([\s\S]*?)```/i;
const nodePattern = /([A-Za-z0-9_-]+)\[([^\]]+)\]/g;
const edgePattern = /([A-Za-z0-9_-]+)(?:\[[^\]]+\])?\s*-->\s*([A-Za-z0-9_-]+)(?:\[[^\]]+\])?/g;

export function extractMermaid(text: string): string | undefined {
  const match = fencedMermaid.exec(text);
  return match?.[1]?.trim() || undefined;
}

export function parseMermaid(source: string): MermaidDiagram {
  const nodes = new Map<string, DiagramNode>();
  for (const match of source.matchAll(nodePattern)) {
    const id = match[1];
    const label = match[2];
    if (id && label) nodes.set(id, { id, label: label.trim() });
  }
  const edges: DiagramEdge[] = [];
  for (const match of source.matchAll(edgePattern)) {
    const from = match[1];
    const to = match[2];
    if (!from || !to) continue;
    edges.push({ from, to });
    for (const id of [from, to]) if (!nodes.has(id)) nodes.set(id, { id, label: id });
  }
  return { nodes: [...nodes.values()], edges };
}
