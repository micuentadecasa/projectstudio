import { describe, expect, it } from "vitest";
import { visibleTextDelta } from "../apps/desktop/src/renderer/chat-events.js";

describe("visibleTextDelta", () => {
  it("accepts visible assistant text deltas", () => {
    expect(visibleTextDelta({
      type: "message_update",
      assistantMessageEvent: { type: "text_delta", delta: "respuesta visible" },
    })).toBe("respuesta visible");
  });

  it("does not expose thinking or tool deltas to the user", () => {
    expect(visibleTextDelta({
      type: "message_update",
      assistantMessageEvent: { type: "thinking_delta", delta: "razonamiento interno" },
    })).toBeUndefined();
    expect(visibleTextDelta({
      type: "message_update",
      assistantMessageEvent: { type: "toolcall_delta", delta: "tool interna" },
    })).toBeUndefined();
  });

});
