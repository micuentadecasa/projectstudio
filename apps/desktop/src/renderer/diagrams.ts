export type DiagramNode = { id: string; label: string };
export type DiagramEdge = { from: string; to: string };
export type MermaidDiagram = { nodes: DiagramNode[]; edges: DiagramEdge[] };
export type LayoutNode = DiagramNode & { x: number; y: number; width: number; height: number; lines: string[] };
export type DiagramLayout = { width: number; height: number; nodes: LayoutNode[]; edges: DiagramEdge[] };

const fencedMermaid = /```mermaid\s*\n([\s\S]*?)(?:```|$)/i;
const nodePattern = /([A-Za-z0-9_-]+)\s*(?:\[\[([^\]]+)\]\]|\[([^\]]+)\]|\(\(([^)]+)\)\)|\(([^)]+)\)|\{\{([^}]+)\}\}|\{([^}]+)\})/g;
const edgePattern = /([A-Za-z0-9_-]+)(?:\s*(?:\[\[[^\]]+\]\]|\[[^\]]+\]|\(\([^)]+\)\)|\([^)]+\)|\{\{[^}]+\}\}|\{[^}]+\}))?\s*(?:-->|-.->|==>)\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_-]+)/g;

export function extractMermaid(text: string): string | undefined {
  const match = fencedMermaid.exec(text);
  return match?.[1]?.trim() || undefined;
}

export function parseMermaid(source: string): MermaidDiagram {
  const nodes = new Map<string, DiagramNode>();
  for (const match of source.matchAll(nodePattern)) {
    const id = match[1];
    const label = match.slice(2).find((value) => value !== undefined);
    const cleanLabel = label?.trim().replaceAll("\\n", " ").replace(/^["']|["']$/g, "");
    if (id && cleanLabel) nodes.set(id, { id, label: cleanLabel });
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

function wrapLabel(label: string, maxCharacters: number): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && `${current} ${word}`.length > maxCharacters) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export function layoutDiagram(diagram: MermaidDiagram): DiagramLayout {
  const nodeIndex = new Map(diagram.nodes.map((node, index) => [node.id, index]));
  const ranks = new Map(diagram.nodes.map((node) => [node.id, 0]));
  const passes = Math.max(1, diagram.nodes.length - 1);
  for (let pass = 0; pass < passes; pass += 1) {
    for (const edge of diagram.edges) {
      const fromIndex = nodeIndex.get(edge.from) ?? 0;
      const toIndex = nodeIndex.get(edge.to) ?? 0;
      if (toIndex > fromIndex) ranks.set(edge.to, Math.min(4, Math.max(ranks.get(edge.to) ?? 0, (ranks.get(edge.from) ?? 0) + 1)));
    }
  }
  const columns = new Map<number, DiagramNode[]>();
  for (const node of diagram.nodes) {
    const rank = ranks.get(node.id) ?? 0;
    const column = columns.get(rank) ?? [];
    column.push(node);
    columns.set(rank, column);
  }
  const maxRows = Math.max(1, ...[...columns.values()].map((column) => column.length));
  const layoutNodes: LayoutNode[] = [];
  for (const [rank, column] of columns) {
    column.forEach((node, row) => {
      layoutNodes.push({
        ...node,
        x: 16 + rank * 190,
        y: 16 + row * 82,
        width: 170,
        height: 54,
        lines: wrapLabel(node.label, 25),
      });
    });
  }
  return { width: Math.max(360, (Math.max(0, ...columns.keys()) + 1) * 190 + 16), height: maxRows * 82 + 16, nodes: layoutNodes, edges: diagram.edges };
}
