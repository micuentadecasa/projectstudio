import { describe, expect, it } from "vitest";
import { textDeltaFromFrame, textFromFrame } from "../packages/orchestrator/src/omp-frame-text.js";

describe("OMP frame text normalization", () => {
  it("keeps visible text and drops thinking/tool deltas", () => {
    expect(textDeltaFromFrame({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "respuesta" } })).toBe("respuesta");
    expect(textDeltaFromFrame({ type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: "interno" } })).toBeUndefined();
    expect(textDeltaFromFrame({ type: "message_update", assistantMessageEvent: { type: "toolcall_delta", delta: "herramienta" } })).toBeUndefined();
  });

  it("accepts the legacy top-level delta and final text fields", () => {
    expect(textDeltaFromFrame({ type: "message_update", delta: "compatibilidad" })).toBe("compatibilidad");
    expect(textFromFrame({ text: "respuesta final" })).toBe("respuesta final");
    expect(textFromFrame({ assistantMessageEvent: { text: "respuesta anidada" } })).toBe("respuesta anidada");
  });
});
