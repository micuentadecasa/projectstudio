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

type StudioProject = {
  id: string;
  name: string;
  path: string;
  mode: "brownfield" | "greenfield";
  archived: boolean;
  lastOpenedAt: string;
  detected: { productShape: boolean; architecture: boolean; empty: boolean };
};
type StudioPdacArtifact = { id: string; type: string; title: string; status?: string; path?: string };
type StudioProjectRegistry = { version: 1; activeId: string; projects: StudioProject[] };

declare global {
  interface Window {
    studio: {
      phase: string;
      runtime: string;
      omp: string;
      projects: {
        list: () => Promise<StudioProjectRegistry>;
        open: () => Promise<{ registry: StudioProjectRegistry; active: StudioProject | null } | null>;
        activate: (id: string) => Promise<{ registry: StudioProjectRegistry; active: StudioProject | null }>;
        archive: (id: string) => Promise<StudioProjectRegistry>;
      };
      project: {
        analysis: () => Promise<{ projectName: string; mermaid: string | null; report: string | null; artifacts?: StudioPdacArtifact[]; updatedAt?: string; stale?: boolean; source: "project-pdac" | "stored-analysis" | "none" }>;
        productshapeGraph: () => Promise<{ ok: boolean; error?: string; artifacts?: StudioPdacArtifact[]; mermaid?: string | null }>;
        savePdacEdit: (edit: { nodeId?: string; page: string; title: string }) => Promise<{ nodeId: string; title: string; updatedAt: string }>;
        bootstrap: (options: { resume?: boolean }) => Promise<{ status: "running" | "completed" | "failed" | "stored-artifact" | "greenfield"; started: boolean; canResume?: boolean }>;
      };
      command: {
        submit: (command: { workflow: "brownfield-discovery" | "architecture-documentation" | "architecture-planning"; prompt: string }) => Promise<{ accepted: boolean; requestId: string }>;
      };
      chat: {
        start: () => Promise<{ mode: string; status: string; projectName: string; projectRoot: string; error?: string }>;
        stop: () => Promise<void>;
        onEvent: (listener: (event: StudioChatEvent) => void) => () => void;
      };
    };
  }
}

export {};
