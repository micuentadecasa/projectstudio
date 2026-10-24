export type ChatFrame = Record<string, unknown>;

function stringField(frame: ChatFrame, name: string): string | undefined {
  const value = frame[name];
  return typeof value === "string" ? value : undefined;
}

export function visibleTextDelta(frame: ChatFrame): string | undefined {
  const nested = frame.assistantMessageEvent;
  if (typeof nested !== "object" || nested === null) return undefined;
  const nestedFrame = nested as ChatFrame;
  if (stringField(nestedFrame, "type") !== "text_delta") return undefined;
  return stringField(nestedFrame, "delta");
}
