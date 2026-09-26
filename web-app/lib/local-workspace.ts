import { z } from "zod";
import { clarificationSchema, homes, levels, students, targets, topicOptions, types, works } from "./study";
import { MAX_BACKUP_BYTES, MAX_HISTORY, sameSurvey, snapshotSchema } from "./session";

export const WORKSPACE_KEY = "say.mine.workspace.v1";
export const WORKSPACE_LOCK = "say.mine.workspace";
const choice = (options: string[]) => z.string().refine(value => options.includes(value));
const draftSchema = z.object({
  work: choice(["", ...works]), student: choice(["", ...students]), home: choice(["", ...homes]),
  level: choice(levels), target: choice(targets), type: choice(types),
  topics: z.array(choice(topicOptions)).max(12).refine(items => new Set(items).size === items.length),
  topic: choice(["", ...topicOptions]), experience: z.string().max(1500),
  clarifications: z.array(clarificationSchema).max(12),
}).strict().refine(value => value.experience.length + value.clarifications.reduce((sum, item) => sum + item.answer.length, 0) <= 1500);

export const workspaceDataSchema = z.object({
  form: draftSchema,
  step: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  current: snapshotSchema.nullable(),
  history: z.array(snapshotSchema).max(MAX_HISTORY),
}).strict().superRefine((data, context) => {
  if (data.step > 0 && (!data.form.work || !data.form.student || !data.form.home || !data.form.topics.includes(data.form.topic))) {
    context.addIssue({ code: "custom", message: "Incomplete background for this step" });
  }
  const sameInput = data.current && sameSurvey(data.form, data.current.input);
  if (data.step === 2 && !sameInput) {
    context.addIssue({ code: "custom", message: "Result must match its saved input" });
  }
  if (!data.current && data.history.length) context.addIssue({ code: "custom", message: "History requires a current note" });
});
export type WorkspaceData = z.infer<typeof workspaceDataSchema>;
const recordSchema = z.object({
  app: z.literal("say.mine.workspace"), version: z.literal(1), savedAt: z.string().datetime(),
  revision: z.string().min(1).max(80), data: workspaceDataSchema,
}).strict();
export type WorkspaceRecord = z.infer<typeof recordSchema>;
export type WorkspaceLoad = {
  kind: "empty" | "ready" | "invalid" | "unavailable";
  raw: string | null;
  record: WorkspaceRecord | null;
};
export type WorkspaceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export class WorkspaceStorageError extends Error {
  constructor(public code: "conflict" | "unavailable" | "full" | "invalid") {
    super(code);
  }
}

export function parseWorkspace(raw: string): WorkspaceRecord {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new WorkspaceStorageError("invalid");
  try { return recordSchema.parse(JSON.parse(raw)); }
  catch { throw new WorkspaceStorageError("invalid"); }
}

export function readWorkspace(storage: WorkspaceStorage): WorkspaceLoad {
  let raw: string | null;
  try { raw = storage.getItem(WORKSPACE_KEY); }
  catch { return { kind: "unavailable", raw: null, record: null }; }
  if (raw === null) return { kind: "empty", raw, record: null };
  try { return { kind: "ready", raw, record: parseWorkspace(raw) }; }
  catch { return { kind: "invalid", raw, record: null }; }
}

function storageFailure(error: unknown): never {
  if (error instanceof WorkspaceStorageError) throw error;
  throw new WorkspaceStorageError(error instanceof Error && error.name === "QuotaExceededError" ? "full" : "unavailable");
}

// The browser adapter holds an exclusive Web Lock around this compare-and-write.
export function saveWorkspace(storage: WorkspaceStorage, expected: string | null, data: WorkspaceData,
  savedAt = new Date().toISOString(), revision = crypto.randomUUID()) {
  let raw: string;
  try { raw = JSON.stringify(recordSchema.parse({ app: "say.mine.workspace", version: 1, savedAt, revision, data })); }
  catch { throw new WorkspaceStorageError("invalid"); }
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new WorkspaceStorageError("full");
  try {
    if (storage.getItem(WORKSPACE_KEY) !== expected) throw new WorkspaceStorageError("conflict");
    storage.setItem(WORKSPACE_KEY, raw);
  } catch (error) { storageFailure(error); }
  return raw;
}

export function removeWorkspace(storage: WorkspaceStorage, expected: string | null) {
  try {
    if (storage.getItem(WORKSPACE_KEY) !== expected) throw new WorkspaceStorageError("conflict");
    storage.removeItem(WORKSPACE_KEY);
  } catch (error) { storageFailure(error); }
}

export async function withWorkspaceStorage<T>(action: (storage: WorkspaceStorage) => T): Promise<T> {
  try {
    if (!navigator.locks) throw new WorkspaceStorageError("unavailable");
    return await navigator.locks.request(WORKSPACE_LOCK, () => action(window.localStorage));
  } catch (error) { return storageFailure(error); }
}

export async function loadBrowserWorkspace(): Promise<WorkspaceLoad> {
  try { return await withWorkspaceStorage(readWorkspace); }
  catch { return { kind: "unavailable", raw: null, record: null }; }
}
