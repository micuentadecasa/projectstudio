export type OmpFrame = Record<string, unknown>;

function nestedFrame(frame: OmpFrame): OmpFrame | undefined {
  const nested = frame.assistantMessageEvent;
  return typeof nested === "object" && nested !== null ? nested as OmpFrame : undefined;
}

export function textDeltaFromFrame(frame: OmpFrame): string | undefined {
  const nested = nestedFrame(frame);
  if (nested && typeof nested.delta === "string" && (nested.type === undefined || nested.type === "text_delta")) return nested.delta;
  if (frame.type === "message_update" && typeof frame.delta === "string") return frame.delta;
  return undefined;
}

export function textFromFrame(frame: OmpFrame): string | undefined {
  if (typeof frame.text === "string") return frame.text;
  const nested = nestedFrame(frame);
  if (nested && typeof nested.text === "string") return nested.text;
  return undefined;
}
