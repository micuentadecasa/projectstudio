import { describe, expect, it } from "vitest";
import { extractMermaid, parseMermaid } from "../apps/desktop/src/renderer/diagrams.js";

describe("diagramas Mermaid del chat", () => {
  it("extrae sólo un bloque Mermaid fenced", () => {
    expect(extractMermaid("Hallazgo\n```mermaid\nflowchart LR\nA[API] --> B[DB]\n```"))
      .toBe("flowchart LR\nA[API] --> B[DB]");
  });

  it("convierte nodos y relaciones en datos renderizables", () => {
    expect(parseMermaid("flowchart LR\nA[API] --> B[DB]")).toEqual({
      nodes: [{ id: "A", label: "API" }, { id: "B", label: "DB" }],
      edges: [{ from: "A", to: "B" }],
    });
  });
});
