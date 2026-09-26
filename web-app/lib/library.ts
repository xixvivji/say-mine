import { practiceRecordSchema, storyFacts, type Snapshot } from "./session";

export type RecordId = "current" | number;
export type StudyRecords = { current: Snapshot | null; history: Snapshot[] };
export type LibraryEntry = { id: RecordId; snapshot: Snapshot };
export type PracticeFilter = "all" | "new" | "completed";
export type LibraryOrder = "newest" | "practice";

export function libraryEntries({ current, history }: StudyRecords): LibraryEntry[] {
  const entries: LibraryEntry[] = history.map((snapshot, id) => ({ id, snapshot }));
  if (current) entries.push({ id: "current", snapshot: current });
  return entries.sort((a, b) => Date.parse(b.snapshot.generatedAt) - Date.parse(a.snapshot.generatedAt)
    || (a.id === "current" ? -1 : b.id === "current" ? 1 : b.id - a.id));
}

export function filterLibrary(entries: LibraryEntry[], topic: string, search: string, favoritesOnly: boolean, practice: PracticeFilter = "all") {
  const words = search.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return entries.filter(({ snapshot }) => {
    if (topic && snapshot.input.topic !== topic || favoritesOnly && !snapshot.favorite) return false;
    if (practice !== "all" && (snapshot.mode !== "llm" || (practice === "completed") !== !!snapshot.practice)) return false;
    const text = [snapshot.input.topic, snapshot.input.type, snapshot.input.level,
      storyFacts(snapshot.input), snapshot.note.question, snapshot.note.answer].join(" ").toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
}

export function orderLibrary(entries: LibraryEntry[], order: LibraryOrder) {
  if (order === "newest") return [...entries];
  return [...entries].sort((a, b) => {
    const left = a.snapshot, right = b.snapshot;
    if (left.mode !== right.mode) return left.mode === "llm" ? -1 : 1;
    if (!!left.practice !== !!right.practice) return left.practice ? 1 : -1;
    return Date.parse(left.practice?.lastCompletedAt ?? left.generatedAt) - Date.parse(right.practice?.lastCompletedAt ?? right.generatedAt);
  });
}

export function practiceTotals(entries: LibraryEntry[]) {
  const playable = entries.filter(({ snapshot }) => snapshot.mode === "llm");
  return {
    available: playable.length,
    unpracticed: playable.filter(({ snapshot }) => !snapshot.practice).length,
    completedSessions: playable.reduce((total, { snapshot }) => total + (snapshot.practice?.completedCount ?? 0), 0),
  };
}

export function recordPracticeCompletion(records: StudyRecords, id: RecordId, completedAt = new Date().toISOString()): StudyRecords {
  const snapshot = id === "current" ? records.current : Number.isInteger(id) ? records.history[id] : null;
  if (!snapshot) throw new Error("복습할 기록을 찾지 못했어요.");
  if (snapshot.mode !== "llm") throw new Error("보완 질문 기록에는 복습 완료를 기록할 수 없어요.");
  const parsed = practiceRecordSchema.safeParse({
    completedCount: (snapshot.practice?.completedCount ?? 0) + 1,
    lastCompletedAt: completedAt,
  });
  if (!parsed.success) throw new Error("완료 횟수 또는 시간을 확인하지 못했어요. 기존 기록은 유지됩니다.");
  const updated = { ...snapshot, practice: parsed.data };
  return id === "current" ? { ...records, current: updated }
    : { ...records, history: records.history.map((item, index) => index === id ? updated : item) };
}

export function toggleFavorite(records: StudyRecords, id: RecordId): StudyRecords {
  if (id === "current") {
    if (!records.current) throw new Error("현재 노트가 없어요.");
    return { ...records, current: { ...records.current, favorite: !records.current.favorite } };
  }
  if (!Number.isInteger(id) || !records.history[id]) throw new Error("해당 기록을 찾지 못했어요.");
  return { ...records, history: records.history.map((item, index) => index === id ? { ...item, favorite: !item.favorite } : item) };
}

export function deleteHistoryRecord(records: StudyRecords, id: RecordId): StudyRecords {
  if (id === "current") throw new Error("현재 작업 중인 노트는 삭제할 수 없어요. 이전 기록만 삭제할 수 있어요.");
  if (!Number.isInteger(id) || !records.history[id]) throw new Error("해당 기록을 찾지 못했어요.");
  return { ...records, history: records.history.filter((_, index) => index !== id) };
}
