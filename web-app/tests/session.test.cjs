const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseSession, serializeSession, nextHistory, replaceStory, readableSession, MAX_BACKUP_BYTES } = require("../.test-build/session.js");
const { levels, surveySchema } = require("../.test-build/study.js");
const input = surveySchema.parse({ work: "일 경험 없음", student: "학생", home: "가족과 거주", target: "IM2", level: levels[0], topics: ["공원 가기"], topic: "공원 가기", type: "경험 이야기", experience: "친구와 공원에서 30분 걸었다.", clarifications: [{ question: "기분은 어땠나요?", answer: "기분이 좋았다." }] });
const snapshot = {
  input, mode: "llm", generatedAt: "2026-09-26T00:00:00.000Z", reason: "initial",
  note: { question: "Describe your park visit.", outline: ["공원 방문", "산책", "좋은 기분"], answer: "I walked with my friend for 30 minutes.", phrases: [{ english: "my friend", korean: "내 친구" }, { english: "I walked", korean: "걸었다" }], keywords: ["park", "friend", "walk"], variations: ["What did you do?", "How did you feel?"], missing_details: [], tip: "키워드로 다시 말해보세요.", variants: Object.fromEntries(levels.map(level => [level, "I walked with my friend for 30 minutes."])), quality_warnings: ["원문을 확인하세요."] },
};
test("JSON roundtrip preserves inputs, previous notes, variants and warnings", () => {
  const restored = parseSession(serializeSession(snapshot, [snapshot]));
  assert.deepEqual(restored.current, snapshot);
  assert.deepEqual(restored.history, [snapshot]);
});
test("unsupported, malformed, oversized or unbounded backups fail", () => {
  assert.throws(() => parseSession("not JSON"));
  assert.throws(() => parseSession("x".repeat(MAX_BACKUP_BYTES + 1)));
  for (const change of [{ version: 2 }, { history: Array(11).fill(snapshot) }, { current: { ...snapshot, input: { ...input, topic: "없는 주제" } } }, { current: { ...snapshot, note: { ...snapshot.note, quality_warnings: Array(7).fill("검토") } } }]) {
    const raw = { ...JSON.parse(serializeSession(snapshot, [])), ...change };
    assert.throws(() => parseSession(JSON.stringify(raw)));
  }
});
test("correction removes old answers without mutating previous snapshot", () => {
  const corrected = replaceStory(input, "친구와 공원에서 20분 걸었다. 기분이 좋았다.");
  assert.deepEqual(corrected.clarifications, []);
  assert.ok(!JSON.stringify(corrected).includes("30"));
  assert.equal(input.clarifications.length, 1);
  assert.throws(() => replaceStory(input, " "));
});
test("history retains only last ten committed snapshots", () => {
  let history = [];
  for (let i = 0; i < 12; i++) history = nextHistory(history, { ...snapshot, generatedAt: String(i) });
  assert.equal(history.length, 10);
  assert.equal(history[0].generatedAt, "2");
  assert.equal(nextHistory(history, null), history);
});
test("TXT includes profile, additional facts, variants, warnings, old facts", () => {
  const text = readableSession(snapshot, [snapshot]);
  for (const part of [input.work, input.clarifications[0].answer, ...levels, "원문을 확인하세요.", "이전 이야기 이력", "30분"]) assert.ok(text.includes(part));
});
