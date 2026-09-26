const { test } = require("node:test");
const assert = require("node:assert/strict");
const { finishPracticeStage } = require("../.test-build/practice.js");

test("partial practice does not count as a completed session", () => {
  let completed = [];
  for (const stage of [0, 1, 2]) {
    const result = finishPracticeStage(completed, stage);
    assert.equal(result.completedSession, false);
    completed = result.stages;
  }
  assert.deepEqual(completed, [0, 1, 2]);
});
test("all four distinct stages count once even when completed out of order", () => {
  let completed = [], count = 0;
  for (const stage of [2, 0, 0, 3, 1, 1, 2, 3]) {
    const result = finishPracticeStage(completed, stage);
    completed = result.stages;
    if (result.completedSession) count++;
  }
  assert.equal(count, 1);
  assert.equal(completed.length, 4);
});
test("duplicate completion events never complete a session early", () => {
  assert.deepEqual(finishPracticeStage([0, 0, 1], 1), { stages: [0, 1], completedSession: false });
  assert.equal(finishPracticeStage([0, 1, 2, 3], 3).completedSession, false);
});
test("completion transitions preserve previous state and reject invalid stages", () => {
  const previous = [0, 1, 2];
  assert.equal(finishPracticeStage(previous, 3).completedSession, true);
  assert.deepEqual(previous, [0, 1, 2]);
  for (const stage of [-1, 4, 0.5, NaN]) assert.throws(() => finishPracticeStage([], stage));
  assert.throws(() => finishPracticeStage([7], 1));
});
test("explicitly starting over requires four stages again", () => {
  let count = 0;
  for (let session = 0; session < 2; session++) {
    let completed = [];
    for (const stage of [0, 1, 2, 3]) {
      const result = finishPracticeStage(completed, stage);
      completed = result.stages;
      if (result.completedSession) count++;
    }
  }
  assert.equal(count, 2);
});
