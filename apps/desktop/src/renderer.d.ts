type StudioChatFrame = Record<string, unknown>;
type StudioChatEvent =
  | { type: "status"; status: string }
  | { type: "ready"; protocolVersion: number }
  | { type: "message_update"; frame: StudioChatFrame }
  | { type: "message_end"; frame: StudioChatFrame }
  | { type: "host_tool_call"; call: { name: string; arguments: unknown } }
  | { type: "prompt_result"; frame: StudioChatFrame }
  | { type: "session_settled" }
  | { type: "queue_update"; frame: StudioChatFrame }
  | { type: "warning"; message: string }
  | { type: "error"; message: string };

declare global {
  interface Window {
    studio: {
      phase: string;
      runtime: string;
      omp: string;
      chat: {
        start: () => Promise<{ mode: string; status: string; error?: string }>;
        send: (message: string) => Promise<{ requestId: string; command: string; accepted: boolean }>;
        stop: () => Promise<void>;
        onEvent: (listener: (event: StudioChatEvent) => void) => () => void;
      };
    };
  }
}

export {};
