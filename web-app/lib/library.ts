import { storyFacts, type Snapshot } from "./session";

export type RecordId = "current" | number;
export type StudyRecords = { current: Snapshot | null; history: Snapshot[] };
export type LibraryEntry = { id: RecordId; snapshot: Snapshot };

export function libraryEntries({ current, history }: StudyRecords): LibraryEntry[] {
  const entries: LibraryEntry[] = history.map((snapshot, id) => ({ id, snapshot }));
  if (current) entries.push({ id: "current", snapshot: current });
  return entries.sort((a, b) => Date.parse(b.snapshot.generatedAt) - Date.parse(a.snapshot.generatedAt)
    || (a.id === "current" ? -1 : b.id === "current" ? 1 : b.id - a.id));
}

export function filterLibrary(entries: LibraryEntry[], topic: string, search: string, favoritesOnly: boolean) {
  const words = search.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return entries.filter(({ snapshot }) => {
    if (topic && snapshot.input.topic !== topic || favoritesOnly && !snapshot.favorite) return false;
    const text = [snapshot.input.topic, snapshot.input.type, snapshot.input.level,
      storyFacts(snapshot.input), snapshot.note.question, snapshot.note.answer].join(" ").toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
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
