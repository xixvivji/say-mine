import { z } from "zod";
import { surveySchema, generationSchema, levels, type Survey } from "./study";

export const MAX_BACKUP_BYTES = 2_000_000;
export const MAX_HISTORY = 10;
export const practiceRecordSchema = z.object({
  completedCount: z.number().int().min(1).max(1_000_000),
  lastCompletedAt: z.string().datetime(),
}).strict();
export const snapshotSchema = generationSchema.extend({
  input: surveySchema,
  generatedAt: z.string().datetime(),
  reason: z.enum(["initial", "addition", "correction"]),
  favorite: z.boolean().optional(),
  practice: practiceRecordSchema.optional(),
}).strict().refine(snapshot => snapshot.mode === "llm" || !snapshot.practice, "보완 질문에는 복습 이력을 넣을 수 없습니다.");
export const sessionSchema = z.object({
  app: z.literal("say.mine"),
  version: z.literal(1),
  savedAt: z.string().datetime(),
  current: snapshotSchema,
  history: z.array(snapshotSchema).max(MAX_HISTORY),
}).strict();
export type Snapshot = z.infer<typeof snapshotSchema>;
export type SavedSession = z.infer<typeof sessionSchema>;

export function sameSurvey(left: Survey, right: Survey) {
  return Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([key, value]) =>
    JSON.stringify(value) === JSON.stringify(right[key as keyof Survey]));
}

export function storyFacts(input: Survey) {
  return [input.experience, ...input.clarifications.map(item => item.answer)].join("\n");
}

export function sourceSegments(input: Survey) {
  // Display only literal source text, not generated summaries or question assumptions.
  return storyFacts(input).split(/(?<=[.!?])\s+|[\r\n]+/u).map(part => part.trim()).filter(Boolean);
}

export function replaceStory(input: Survey, correctedStory: string): Survey {
  return surveySchema.parse({ ...input, experience: correctedStory, clarifications: [] });
}

export function nextHistory(history: Snapshot[], previous: Snapshot | null) {
  if (!previous) return history;
  const next = [...history, previous];
  while (next.length > MAX_HISTORY) {
    const removable = next.findIndex(item => !item.favorite);
    if (removable < 0) throw new Error("보관함이 즐겨찾기로 가득 찼어요. 이전 기록 하나의 즐겨찾기를 해제하거나 삭제한 뒤 다시 만들어 주세요.");
    next.splice(removable, 1);
  }
  return next;
}

export function serializeSession(current: Snapshot, history: Snapshot[]) {
  const session = sessionSchema.parse({ app: "say.mine", version: 1, savedAt: new Date().toISOString(), current, history });
  const text = JSON.stringify(session, null, 2);
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error("저장 파일이 너무 큽니다.");
  return text;
}

export function parseSession(text: string): SavedSession {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error("JSON 파일은 2MB 이내로 선택해 주세요.");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("올바른 JSON 파일이 아닙니다."); }
  const result = sessionSchema.safeParse(raw);
  if (!result.success) throw new Error("지원하는 say.mine 학습 파일이 아니거나 내용이 손상됐어요. 버전 1 JSON 파일을 선택해 주세요.");
  return result.data;
}

const reasonLabels = { initial: "새 이야기", addition: "정보 추가", correction: "내용 정정" };
export function readableSession(current: Snapshot, history: Snapshot[]) {
  const { input, note } = current;
  return [
    `# ${input.topic} · ${input.type} · ${input.level}`,
    `배경: ${input.work} / ${input.student} / ${input.home}\n관심사: ${input.topics.join(", ")}\n목표: ${input.target}`,
    `## 현재 원문\n${input.experience}`,
    `## 복습 이력\n${current.practice ? `4단계 완료 ${current.practice.completedCount}회 · 마지막 완료 ${current.practice.lastCompletedAt}` : "완료 기록 없음"}\n직접 표시한 연습 이력이며 말하기 능력 평가가 아닙니다.`,
    `## 추가 답변\n${input.clarifications.map(item => `질문: ${item.question}\n답변: ${item.answer}`).join("\n\n") || "없음"}`,
    `## 연습 질문\n${note.question}`,
    `## 이야기 뼈대\n${note.outline.join("\n")}`,
    `## 선택한 답변\n${note.answer}`,
    `## 세 수준 비교\n${levels.map(level => `${level}\n${note.variants[level] || "표시할 초안 없음"}`).join("\n\n")}`,
    `## 표현\n${note.phrases.map(p => `${p.english} — ${p.korean}`).join("\n")}`,
    `## 키워드\n${note.keywords.join(", ")}\n\n## 변형 질문\n${note.variations.join("\n")}`,
    `## 보완 질문\n${note.missing_details.join("\n") || "없음"}\n\n## 연습 팁\n${note.tip}`,
    `## 검토 안내\n${note.quality_warnings.join("\n") || "자동 점검에서 알림 없음. 사실·문법 검증 완료를 뜻하지 않습니다."}`,
    `## 이전 이야기 이력 (최대 ${MAX_HISTORY}개)\n${history.map((item, i) => `${i + 1}. ${reasonLabels[item.reason]} · ${item.generatedAt}\n${storyFacts(item.input)}`).join("\n\n") || "없음"}`,
    "전체 이전 노트까지 다시 불러오려면 JSON 저장을 사용하세요. 진행 중인 입력과 타이머는 저장하지 않습니다.",
  ].join("\n\n");
}
