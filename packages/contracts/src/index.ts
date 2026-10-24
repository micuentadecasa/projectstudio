import { z } from "zod";

export const StudioModeSchema = z.enum([
  "navigate",
  "discovery",
  "product",
  "architecture",
  "coding",
  "cloud",
]);

export const GateStateSchema = z.enum([
  "not-required",
  "pending",
  "approved",
  "rejected",
  "changes-requested",
]);
export const JobStateSchema = z.enum([
  "queued",
  "running",
  "waiting-approval",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);

export const WorkspaceWorkflowSchema = z.enum([
  "brownfield-discovery",
  "architecture-documentation",
  "architecture-planning",
]);

export const ArchitectureEnvironmentSchema = z.enum(["local", "aws", "azure"]);

export const WorkspaceIntentSchema = z.object({
  workflow: WorkspaceWorkflowSchema,
  environment: ArchitectureEnvironmentSchema,
  sourceOfTruth: z.enum(["observed", "accepted", "proposal"]),
  requiresApproval: z.boolean(),
});

export type WorkspaceWorkflow = z.infer<typeof WorkspaceWorkflowSchema>;
export type ArchitectureEnvironment = z.infer<typeof ArchitectureEnvironmentSchema>;
export type WorkspaceIntent = z.infer<typeof WorkspaceIntentSchema>;

export const StudioEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().min(1),
  projectId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  draftId: z.string().min(1).optional(),
  requestId: z.string().min(1),
  correlationId: z.string().min(1),
  emittedAt: z.iso.datetime(),
  sequence: z.number().int().nonnegative(),
  origin: z.enum(["chat", "ui", "canvas", "system", "cloud"]),
  type: z.string().min(1),
  payload: z.unknown(),
});

export const ViewCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("view.open"),
    viewId: z.string().min(1),
    kind: z.enum([
      "pdac-document",
      "pdac-graph",
      "c4",
      "sketch",
      "git-diff",
      "logs",
      "api-tests",
      "comparison",
      "evidence",
    ]),
    targetId: z.string().min(1).optional(),
    environmentId: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("view.focus"),
    viewId: z.string().min(1),
    elementIds: z.array(z.string().min(1)),
    mode: z.enum(["fit", "center", "highlight"]),
  }),
  z.object({
    type: z.literal("view.select"),
    viewId: z.string().min(1),
    elementIds: z.array(z.string().min(1)),
  }),
  z.object({
    type: z.literal("view.update"),
    viewId: z.string().min(1),
    expectedRevision: z.number().int().nonnegative(),
    patch: z.unknown(),
  }),
  z.object({
    type: z.literal("view.compare"),
    leftViewId: z.string().min(1),
    rightViewId: z.string().min(1),
    diffId: z.string().min(1),
  }),
]);

export const StudioGraphStateSchema = z.object({
  projectId: z.string().min(1),
  threadId: z.string().min(1),
  runId: z.string().min(1),
  requestId: z.string().min(1),
  mode: StudioModeSchema,
  jobStatus: JobStateSchema,
  userIntent: z.string(),
  selection: z.object({
    artifactIds: z.array(z.string()),
    semanticIds: z.array(z.string()),
    repoIds: z.array(z.string()),
  }),
  omp: z.object({
    sessionKey: z.string().optional(),
    requestId: z.string().optional(),
    status: z.enum(["idle", "working", "settled", "error"]),
  }),
  proposals: z.array(z.string()),
  artifactIds: z.array(z.string()),
  gate: z.object({
    status: GateStateSchema,
    gateId: z.string().optional(),
    targetRevision: z.number().int().nonnegative().optional(),
    exactScope: z.array(z.string()).optional(),
  }),
  budget: z.object({
    maxTokens: z.number().int().positive().optional(),
    usedTokens: z.number().int().nonnegative().optional(),
    maxArtifacts: z.number().int().positive().optional(),
    timeoutMs: z.number().int().positive(),
  }),
  errors: z.array(z.object({
    code: z.string().min(1),
    message: z.string(),
    recoverable: z.boolean(),
  })),
});

export type StudioEnvelope = z.infer<typeof StudioEnvelopeSchema>;
export type ViewCommand = z.infer<typeof ViewCommandSchema>;
export type StudioGraphState = z.infer<typeof StudioGraphStateSchema>;
