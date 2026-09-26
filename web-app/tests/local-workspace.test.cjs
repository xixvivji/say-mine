const { test } = require("node:test");
const assert = require("node:assert/strict");
const { WORKSPACE_KEY, WORKSPACE_LOCK, parseWorkspace, readWorkspace, saveWorkspace, removeWorkspace, withWorkspaceStorage, loadBrowserWorkspace } = require("../.test-build/local-workspace.js");
const { surveySchema, levels } = require("../.test-build/study.js");
const { MAX_BACKUP_BYTES } = require("../.test-build/session.js");

function memory() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const draft = { work: "", student: "", home: "", level: levels[0], target: "미정", topics: [], topic: "", type: "경험 이야기", experience: "", clarifications: [] };
const blank = { form: draft, step: 0, current: null, history: [] };
const input = surveySchema.parse({ ...draft, work: "일 경험 없음", student: "학생", home: "가족과 거주", topics: ["공원 가기"], topic: "공원 가기", experience: "친구와 공원에서 30분 걸었다." });
const snapshot = {
  input, mode: "llm", generatedAt: "2026-09-26T00:00:00.000Z", reason: "initial",
  note: { question: "Describe your park visit.", outline: ["공원 방문", "산책", "시간"], answer: "I walked with my friend for 30 minutes.", phrases: [{ english: "my friend", korean: "내 친구" }, { english: "I walked", korean: "걸었다" }], keywords: ["park", "friend", "walk"], variations: ["What did you do?", "How did you feel?"], missing_details: [], tip: "키워드로 다시 말해보세요.", variants: {}, quality_warnings: [] },
};
const finished = { form: input, step: 2, current: snapshot, history: [snapshot] };
const save = (storage, expected, data = blank) => saveWorkspace(storage, expected, data, "2026-09-26T01:00:00.000Z", "test-revision");
const hasCode = code => error => error.code === code;

test("first visit reads as opt-out and creates no storage entry", () => {
  const storage = memory();
  assert.deepEqual(readWorkspace(storage), { kind: "empty", raw: null, record: null });
  assert.equal(storage.values.size, 0);
});
test("partial background and experience roundtrip without trimming or model calls", () => {
  const storage = memory();
  const data = { ...blank, form: { ...draft, student: "학생", experience: "  아직 작성 중\n" } };
  save(storage, null, data);
  assert.deepEqual(readWorkspace(storage).record.data.form, data.form);
});
test("result, current facts and bounded history restore independently of object key order", () => {
  const storage = memory();
  const data = { ...finished, form: Object.fromEntries(Object.entries(input).reverse()) };
  const raw = save(storage, null, data);
  const result = parseWorkspace(raw);
  assert.deepEqual(result.data.current, snapshot);
  assert.deepEqual(result.data.history, [snapshot]);
  assert.equal(result.data.step, 2);
});
test("editing a new story preserves the last generated note instead of mixing facts", () => {
  const storage = memory();
  const data = { ...finished, step: 1, form: { ...input, experience: "새 이야기 작성 중" } };
  const result = parseWorkspace(save(storage, null, data));
  assert.equal(result.data.form.experience, "새 이야기 작성 중");
  assert.equal(result.data.current.input.experience, input.experience);
});
test("corrupt, oversized and future records remain untouched for explicit recovery", () => {
  for (const raw of ["broken", "x".repeat(MAX_BACKUP_BYTES + 1), '{"version":99}']) {
    const storage = memory(); storage.setItem(WORKSPACE_KEY, raw);
    assert.equal(readWorkspace(storage).kind, "invalid");
    assert.equal(storage.getItem(WORKSPACE_KEY), raw);
  }
});
test("invalid states cannot overwrite a valid record", () => {
  const storage = memory(); const previous = save(storage, null);
  for (const data of [
    { ...blank, form: { ...draft, experience: "가".repeat(1501) } },
    { ...blank, form: { ...draft, work: "임의 선택" } },
    { ...blank, step: 1 }, { ...blank, step: 2 },
    { ...finished, history: Array(11).fill(snapshot) },
    { ...finished, form: { ...input, experience: "다른 사실로 바꿈" } },
    { ...blank, history: [snapshot] }, { ...blank, extra: "unexpected" },
  ]) {
    assert.throws(() => save(storage, previous, data), hasCode("invalid"));
    assert.equal(storage.getItem(WORKSPACE_KEY), previous);
  }
});
test("quota failure keeps the previous record", () => {
  const storage = memory(); const previous = save(storage, null);
  storage.setItem = () => { const error = new Error("private detail"); error.name = "QuotaExceededError"; throw error; };
  assert.throws(() => save(storage, previous, finished), hasCode("full"));
  assert.equal(storage.getItem(WORKSPACE_KEY), previous);
});
test("denied reads and writes are safe failures without leaking private exceptions", () => {
  const denied = { getItem() { throw new Error("private path"); }, setItem() {}, removeItem() {} };
  assert.equal(readWorkspace(denied).kind, "unavailable");
  assert.throws(() => save(denied, null), error => error.code === "unavailable" && !error.message.includes("private"));
});
test("stale writes and deletes never replace another tab's record", () => {
  const storage = memory(); const first = save(storage, null);
  const latest = save(storage, first, finished);
  assert.throws(() => save(storage, first), hasCode("conflict"));
  assert.throws(() => removeWorkspace(storage, first), hasCode("conflict"));
  assert.equal(storage.getItem(WORKSPACE_KEY), latest);
});
test("forget removes only the say.mine key, preserving unrelated browser data", () => {
  const storage = memory(); storage.setItem("unrelated", "keep");
  const raw = save(storage, null);
  removeWorkspace(storage, raw);
  assert.equal(storage.getItem(WORKSPACE_KEY), null);
  assert.equal(storage.getItem("unrelated"), "keep");
});

async function browserEnvironment(value, run) {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: value.navigator });
  Object.defineProperty(globalThis, "window", { configurable: true, value: value.window });
  try { await run(); }
  finally {
    if (oldNavigator) Object.defineProperty(globalThis, "navigator", oldNavigator); else delete globalThis.navigator;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else delete globalThis.window;
  }
}
test("exclusive lock serializes competing saves, so only one stale writer succeeds", async () => {
  const storage = memory(); let tail = Promise.resolve(); const names = [];
  const locks = { request(name, action) { names.push(name); const work = tail.then(action); tail = work.catch(() => {}); return work; } };
  await browserEnvironment({ navigator: { locks }, window: { localStorage: storage } }, async () => {
    const results = await Promise.allSettled([
      withWorkspaceStorage(s => save(s, null, blank)),
      withWorkspaceStorage(s => save(s, null, finished)),
    ]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(results.find(r => r.status === "rejected").reason.code, "conflict");
    assert.deepEqual(names, [WORKSPACE_LOCK, WORKSPACE_LOCK]);
  });
});
test("unsupported locks and denied storage disable persistence without mutation", async () => {
  const storage = memory();
  await browserEnvironment({ navigator: {}, window: { localStorage: storage } }, async () => {
    assert.equal((await loadBrowserWorkspace()).kind, "unavailable");
    await assert.rejects(withWorkspaceStorage(s => save(s, null)), hasCode("unavailable"));
    assert.equal(storage.values.size, 0);
  });
  await browserEnvironment({ navigator: { locks: { request: (_name, action) => action() } }, window: { get localStorage() { throw new Error("denied"); } } }, async () => {
    assert.equal((await loadBrowserWorkspace()).kind, "unavailable");
  });
});
