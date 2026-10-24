import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractMermaid, layoutDiagram, parseMermaid } from "../apps/desktop/src/renderer/diagrams.js";

describe("diagramas Mermaid del chat", () => {
  it("extrae sólo un bloque Mermaid fenced", () => {
    expect(extractMermaid("Hallazgo\n```mermaid\nflowchart LR\nA[API] --> B[DB]\n```"))
      .toBe("flowchart LR\nA[API] --> B[DB]");
  });
  it("extrae el Mermaid aunque el stream todavía no haya cerrado el fence", () => {
    expect(extractMermaid("Hallazgo parcial\n```mermaid\nflowchart LR\nA[API] --> B[DB]"))
      .toBe("flowchart LR\nA[API] --> B[DB]");
  });

  it("convierte nodos y relaciones en datos renderizables", () => {
    expect(parseMermaid("flowchart LR\nA[API] --> B[DB]")).toEqual({
      nodes: [{ id: "A", label: "API" }, { id: "B", label: "DB" }],
      edges: [{ from: "A", to: "B" }],
    });
  });
  it("parsea y distribuye el Mermaid guardado por la revisión ProductShape CLI real de Notes sin llamar a OMP", async () => {
    const source = await readFile(resolve(process.cwd(), "docs/implementation/evidence/F05-T01-notes-productshape-cli.mermaid"), "utf8");
    const diagram = parseMermaid(source);
    const layout = layoutDiagram(diagram);
    expect(source).toContain("flowchart LR");
    expect(source).toContain("MuScriptor");
    expect(source).toContain("SQLite");
    expect(diagram.nodes.length).toBeGreaterThan(5);
    expect(diagram.edges.length).toBeGreaterThan(10);
    expect(layout.nodes.every((node) => node.lines.length > 0)).toBe(true);
    expect(layout.width).toBeGreaterThan(360);
  });
});
