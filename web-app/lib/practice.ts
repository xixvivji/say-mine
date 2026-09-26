export const practiceStages = ["전체 답변", "한국어 뼈대", "영어 키워드", "질문만"];

// A session is complete once each distinct stage is explicitly marked complete.
export function finishPracticeStage(completed: number[], stage: number) {
  if (![...completed, stage].every(value => Number.isInteger(value) && value >= 0 && value < practiceStages.length)) {
    throw new Error("올바른 연습 단계를 선택해 주세요.");
  }
  const previous = [...new Set(completed)];
  const stages = [...new Set([...previous, stage])];
  return { stages, completedSession: previous.length < practiceStages.length && stages.length === practiceStages.length };
}
