const { test } = require("node:test");
const assert = require("node:assert/strict");
const { libraryEntries, filterLibrary, toggleFavorite, deleteHistoryRecord, recordPracticeCompletion, orderLibrary, practiceTotals } = require("../.test-build/library.js");
const { nextHistory, parseSession, serializeSession, readableSession, snapshotSchema, MAX_HISTORY } = require("../.test-build/session.js");
const { saveWorkspace, parseWorkspace } = require("../.test-build/local-workspace.js");
const { levels } = require("../.test-build/study.js");

function note(day, topic = "공원 가기", favorite) {
  return snapshotSchema.parse({
    input: { work: "일 경험 없음", student: "학생", home: "가족과 거주", target: "IM2", level: levels[0], topics: [topic], topic, type: "경험 이야기", experience: "친구와 함께 걸으며 이야기했다.", clarifications: [{ question: "어땠나요?", answer: "공기가 시원했다." }] },
    mode: "llm", generatedAt: `2026-09-${String(day).padStart(2, "0")}T00:00:00.000Z`, reason: "initial",
    ...(favorite === undefined ? {} : { favorite }),
    note: { question: "What did you do?", outline: ["함께 걷기", "이야기", "공기"], answer: "I walked with a friend and talked.", phrases: [{ english: "a friend", korean: "친구" }, { english: "I walked", korean: "걸었다" }], keywords: ["walk", "friend", "talk"], variations: ["Who was with you?", "How was it?"], missing_details: [], tip: "키워드를 보고 말해보세요.", variants: {}, quality_warnings: [] },
  });
}
test("empty library has no fabricated records", () => {
  assert.deepEqual(libraryEntries({ current: null, history: [] }), []);
});
test("library sorts by actual dates and retains original history IDs without mutating", () => {
  const records = { current: note(4), history: [note(3), note(1), note(2)] };
  const before = JSON.stringify(records);
  assert.deepEqual(libraryEntries(records).map(item => item.id), ["current", 0, 2, 1]);
  assert.equal(JSON.stringify(records), before);
});
test("equal-date and identical notes remain individually addressable", () => {
  const snapshot = note(1);
  const records = { current: snapshot, history: [snapshot, snapshot] };
  assert.deepEqual(libraryEntries(records).map(item => item.id), ["current", 1, 0]);
  assert.equal(deleteHistoryRecord(records, 0).history.length, 1);
  assert.equal(toggleFavorite(records, 1).history[0].favorite, undefined);
});
test("topic, multiple search terms and favorites combine, ignoring search case and space", () => {
  const entries = libraryEntries({ current: note(3, "공원 가기", true), history: [note(1, "공원 가기"), note(2, "영화 보기", true)] });
  assert.equal(filterLibrary(entries, "공원 가기", "  FRIEND  시원  ", true).length, 1);
  assert.equal(filterLibrary(entries, "영화 보기", "", false).length, 1);
  assert.equal(filterLibrary(entries, "", "없는내용", false).length, 0);
  assert.equal(filterLibrary(entries, "", "   ", false).length, 3);
  assert.equal(filterLibrary(entries, "", "", true).length, 2);
});
test("favorite toggling does not change input, answer, dates or unrelated records", () => {
  const records = { current: note(3), history: [note(1), note(2)] };
  const before = JSON.stringify(records);
  const toggled = toggleFavorite(records, 0);
  assert.equal(toggled.current, records.current);
  assert.equal(toggled.history[0].favorite, true);
  assert.equal(toggled.history[1], records.history[1]);
  assert.equal(toggleFavorite(toggled, 0).history[0].favorite, false);
  assert.deepEqual(toggleFavorite(records, "current").current.input, records.current.input);
  assert.equal(JSON.stringify(records), before);
});
test("delete targets only the specified old note and rejects current or invalid IDs", () => {
  const records = { current: note(3), history: [note(1, "공원 가기", true), note(2)] };
  const result = deleteHistoryRecord(records, 0);
  assert.equal(result.current, records.current);
  assert.deepEqual(result.history, [records.history[1]]);
  assert.equal(records.history.length, 2);
  for (const id of ["current", -1, 7, 0.5]) assert.throws(() => deleteHistoryRecord(records, id));
  for (const id of [-1, 7, 0.5]) assert.throws(() => toggleFavorite(records, id));
  assert.throws(() => toggleFavorite({ current: null, history: [] }, "current"));
});
test("JSON preserves favorite flags and still accepts legacy records without metadata", () => {
  const session = parseSession(serializeSession(note(3, "공원 가기", true), [note(1), note(2, "영화 보기", false)]));
  assert.equal(session.current.favorite, true);
  assert.equal(session.history[0].favorite, undefined);
  assert.equal(session.history[1].favorite, false);
  assert.throws(() => serializeSession({ ...note(1), favorite: "true" }, []));
});
test("autosave roundtrip preserves favorites and an independent unfinished draft", () => {
  const current = note(3, "공원 가기", true);
  const data = { step: 1, form: { ...current.input, experience: "아직 쓰고 있는 다른 이야기" }, current, history: [note(1)] };
  let value = null;
  const storage = { getItem: () => value, setItem: (_key, raw) => { value = raw; } };
  const raw = saveWorkspace(storage, null, data);
  assert.deepEqual(parseWorkspace(raw).data, data);
});
test("capacity removes the oldest nonfavorite while retaining favorite snapshots", () => {
  const history = Array.from({ length: MAX_HISTORY }, (_, i) => note(i + 1, "공원 가기", i === 0));
  const before = JSON.stringify(history);
  const next = nextHistory(history, note(11));
  assert.equal(next.length, MAX_HISTORY);
  assert.equal(next[0], history[0]);
  assert.equal(next[1], history[2]);
  assert.equal(JSON.stringify(history), before);
});
test("all-favorite capacity fails safely, and unpinning frees space", () => {
  const history = Array.from({ length: MAX_HISTORY }, (_, i) => note(i + 1, "공원 가기", true));
  const current = note(11, "공원 가기", true);
  assert.throws(() => nextHistory(history, current), /즐겨찾기/);
  assert.deepEqual(nextHistory(history, { ...current, favorite: false }), history);
  const unpinned = toggleFavorite({ current, history }, 3);
  assert.equal(nextHistory(unpinned.history, current).length, MAX_HISTORY);
});

const firstCompletedAt = "2026-09-26T01:00:00.000Z";
const secondCompletedAt = "2026-09-27T01:00:00.000Z";
test("recording completion updates only the chosen note metadata, not its facts or draft", () => {
  const records = { current: note(3), history: [note(1, "공원 가기", true), note(2)] };
  const before = JSON.stringify(records);
  const updated = recordPracticeCompletion(records, 0, firstCompletedAt);
  assert.equal(updated.current, records.current);
  assert.equal(updated.history[1], records.history[1]);
  assert.deepEqual(updated.history[0].practice, { completedCount: 1, lastCompletedAt: firstCompletedAt });
  assert.deepEqual(updated.history[0].input, records.history[0].input);
  assert.deepEqual(updated.history[0].note, records.history[0].note);
  assert.equal(updated.history[0].generatedAt, records.history[0].generatedAt);
  assert.equal(updated.history[0].favorite, true);
  assert.equal(JSON.stringify(records), before);
});
test("a subsequent completed session increments the count and updates the completion time", () => {
  const records = { current: note(3), history: [note(1)] };
  const first = recordPracticeCompletion(records, "current", firstCompletedAt);
  const second = recordPracticeCompletion(first, "current", secondCompletedAt);
  assert.deepEqual(second.current.practice, { completedCount: 2, lastCompletedAt: secondCompletedAt });
  assert.equal(first.current.practice.completedCount, 1);
});
test("invalid, missing, clarification or overflowing completion cannot mutate records", () => {
  const records = { current: note(3), history: [{ ...note(1), mode: "clarification" }] };
  const before = JSON.stringify(records);
  for (const id of [0, -1, 3, 0.5]) assert.throws(() => recordPracticeCompletion(records, id, firstCompletedAt));
  assert.throws(() => recordPracticeCompletion(records, "current", "not-a-date"));
  assert.throws(() => recordPracticeCompletion({ current: null, history: [] }, "current"));
  const full = { current: { ...note(1), practice: { completedCount: 1_000_000, lastCompletedAt: firstCompletedAt } }, history: [] };
  assert.throws(() => recordPracticeCompletion(full, "current", secondCompletedAt));
  assert.equal(full.current.practice.completedCount, 1_000_000);
  assert.equal(JSON.stringify(records), before);
});
test("practice filters exclude clarification-only notes and combine with other filters", () => {
  const done = recordPracticeCompletion({ current: note(3, "공원 가기", true), history: [] }, "current", firstCompletedAt).current;
  const entries = libraryEntries({ current: done, history: [note(1), { ...note(2), mode: "clarification" }] });
  assert.deepEqual(filterLibrary(entries, "", "", false, "new").map(item => item.id), [0]);
  assert.deepEqual(filterLibrary(entries, "공원 가기", "friend", true, "completed").map(item => item.id), ["current"]);
  assert.equal(filterLibrary(entries, "", "", false).length, 3);
});
test("practice ordering prioritizes uncompleted notes, then oldest completed, with clarification last", () => {
  const done = recordPracticeCompletion({ current: note(2), history: [] }, "current", firstCompletedAt).current;
  const recent = { ...done, generatedAt: note(3).generatedAt, practice: { completedCount: 2, lastCompletedAt: secondCompletedAt } };
  const entries = libraryEntries({ current: recent, history: [done, note(5), note(4), { ...note(1), mode: "clarification" }] });
  const before = JSON.stringify(entries);
  assert.deepEqual(orderLibrary(entries, "practice").map(item => item.id), [2, 1, 0, "current", 3]);
  assert.deepEqual(orderLibrary(entries, "newest"), entries);
  assert.equal(JSON.stringify(entries), before);
});
test("totals describe retained playable notes only, not lifetime activity or skill", () => {
  const done = recordPracticeCompletion({ current: note(3), history: [] }, "current", firstCompletedAt).current;
  const entries = libraryEntries({ current: done, history: [note(1), { ...note(2), mode: "clarification" }] });
  assert.deepEqual(practiceTotals(entries), { available: 2, unpracticed: 1, completedSessions: 1 });
  assert.deepEqual(practiceTotals([]), { available: 0, unpracticed: 0, completedSessions: 0 });
});
test("JSON, TXT and autosave preserve completion metadata and still accept old backups", () => {
  const records = recordPracticeCompletion({ current: note(3, "공원 가기", true), history: [note(1)] }, "current", firstCompletedAt);
  const restored = parseSession(serializeSession(records.current, records.history));
  assert.deepEqual(restored.current.practice, records.current.practice);
  assert.equal(restored.history[0].practice, undefined);
  assert.match(readableSession(records.current, records.history), /4단계 완료 1회/);
  const data = { ...records, form: { ...records.current.input, experience: "작성 중인 다른 이야기" }, step: 1 };
  const storage = { getItem: () => null, setItem: () => {} };
  assert.deepEqual(parseWorkspace(saveWorkspace(storage, null, data)).data, data);
  assert.equal(parseSession(serializeSession(note(1), [])).current.practice, undefined);
});
test("malformed practice metadata is rejected instead of silently inflated or coerced", () => {
  for (const practice of [
    { completedCount: 0, lastCompletedAt: firstCompletedAt },
    { completedCount: -1, lastCompletedAt: firstCompletedAt },
    { completedCount: 1.5, lastCompletedAt: firstCompletedAt },
    { completedCount: "1", lastCompletedAt: firstCompletedAt },
    { completedCount: 1, lastCompletedAt: "invalid" },
    { completedCount: 1, lastCompletedAt: firstCompletedAt, extra: true },
  ]) assert.throws(() => serializeSession({ ...note(1), practice }, []));
  assert.throws(() => serializeSession({ ...note(1), mode: "clarification", practice: { completedCount: 1, lastCompletedAt: firstCompletedAt } }, []));
});
test("archiving preserves old practice metadata without copying it to a new generation", () => {
  const done = recordPracticeCompletion({ current: note(1), history: [] }, "current", firstCompletedAt).current;
  const history = nextHistory([], done);
  assert.deepEqual(history[0].practice, done.practice);
  assert.equal(note(2).practice, undefined);
});
