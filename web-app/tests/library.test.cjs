const { test } = require("node:test");
const assert = require("node:assert/strict");
const { libraryEntries, filterLibrary, toggleFavorite, deleteHistoryRecord } = require("../.test-build/library.js");
const { nextHistory, parseSession, serializeSession, snapshotSchema, MAX_HISTORY } = require("../.test-build/session.js");
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
