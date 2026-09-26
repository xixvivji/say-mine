"use client";
import { useEffect, useRef, useState } from "react";
import { levels, type Note, type Clarification } from "@/lib/study";

const guides = [
  "한 문장에 한 가지 사실을 담아요. 문장마다 주어와 동사를 찾아보세요.",
  "이유·결과·시간을 연결하는 표현을 찾아보세요. 원문에 있는 관계인지도 확인해요.",
  "세부 정보가 어느 문장에 묶였는지 살펴보세요. 더 긴 답변이 항상 더 좋은 것은 아니에요.",
];
export function AnswerComparison({ note, level }: { note: Note; level: string }) {
  const [selected, setSelected] = useState(level);
  return <details className="study-panel comparison">
    <summary>같은 이야기, 세 가지 표현 비교</summary>
    <p className="footnote">비교용 초안이에요. 위 연습 노트는 처음 선택한 수준을 기준으로 유지돼요.</p>
    <div className="study-options" role="group" aria-label="비교할 표현 수준">
      {levels.map((item) => <button key={item} className="secondary" aria-pressed={selected === item} onClick={() => setSelected(item)}>{item}</button>)}
    </div>
    <p className="style-guide">{guides[levels.indexOf(selected)]}</p>
    {note.variants[selected] ? <p className="comparison-answer" lang="en">{note.variants[selected]}</p> : <p role="status">이 수준의 초안은 숫자 검사를 통과하지 못했거나 저장된 초안이 없어 표시하지 않았어요.</p>}
    {note.quality_warnings.length > 0 && <div className="quality-review"><strong>표현 점검 안내 · 자동 채점 아님</strong><ul>{note.quality_warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
    <p className="footnote">원래 이야기의 시간·인물·감정이 그대로인지 비교해 주세요.</p>
  </details>;
}

const stages = ["전체 답변", "한국어 뼈대", "영어 키워드", "질문만"];
export function SpeakingPractice({ note }: { note: Note }) {
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const started = useRef(0);
  const accumulated = useRef(0);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed(accumulated.current + performance.now() - started.current), 250);
    return () => clearInterval(timer);
  }, [running]);
  function pause(now: number) {
    if (running) {
      accumulated.current += now - started.current;
      setElapsed(accumulated.current);
    }
    setRunning(false);
  }
  function changeStage(next: number, now: number) {
    pause(now);
    accumulated.current = 0;
    setElapsed(0);
    setStage(next);
  }
  const seconds = Math.floor(elapsed / 1000);
  return <section className="study-panel practice-panel" aria-label="말하기 연습">
    <p className="eyebrow">SPEAK IN YOUR OWN WORDS</p>
    <h3>도움을 줄이며 네 번 말해보세요.</h3>
    <div className="study-options" role="group" aria-label="연습 단계">
      {stages.map((label, index) => <button className="secondary" key={label} aria-pressed={index === stage} onClick={() => changeStage(index, performance.now())}>{completed.includes(index) ? "✓ " : ""}{index + 1}. {label}</button>)}
    </div>
    <p className="practice-question" lang="en">{note.question}</p>
    <div className="practice-content">
      {stage === 0 && <p lang="en">{note.answer}</p>}
      {stage === 1 && <ol>{note.outline.map((line, i) => <li key={i}>{line}</li>)}</ol>}
      {stage === 2 && <p lang="en">{note.keywords.join(" · ")}</p>}
      {stage === 3 && <p className="footnote">질문을 보고 내 이야기로 답해보세요. 막히면 앞 단계로 돌아가도 괜찮아요.</p>}
    </div>
    <div className="practice-controls">
      <output aria-live="off" aria-label="연습 시간" className="practice-clock">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</output>
      <button className="secondary" onClick={() => { if (running) pause(performance.now()); else { started.current = performance.now(); setRunning(true); } }}>{running ? "잠시 멈춤" : "타이머 시작"}</button>
      <button className="primary" disabled={elapsed === 0} onClick={() => { pause(performance.now()); setCompleted((items) => [...new Set([...items, stage])]); }}>이 단계 연습 완료</button>
    </div>
    <p className="footnote">녹음 없이 소리 내어 연습해요. 타이머와 완료 표시는 이 연습 화면에서만 유지돼요.</p>
    <p role="status" className="practice-status">{completed.length === 4 ? "네 단계 모두 완료했어요! 대본 없이도 전달한 내용을 떠올려보세요." : `${completed.length} / 4 단계 완료${completed.includes(stage) ? " · 이 단계를 마쳤어요." : ""}`}</p>
    {completed.includes(stage) && stage < 3 && <button className="secondary" onClick={() => changeStage(stage + 1, performance.now())}>다음 단계: {stages[stage + 1]} →</button>}
  </section>;
}

export function Followup({ questions, experience, history, loading, error, onSubmit, onCorrect, onDirty }: {
  questions: string[]; experience: string; history: Clarification[]; loading: boolean; error: string;
  onSubmit: (clarifications: Clarification[]) => void; onCorrect: (story: string) => void; onDirty: (dirty: boolean) => void;
}) {
  const prompts = questions.length ? questions : ["추가하거나 더 구체적으로 설명할 내용이 있나요?"];
  const [answers, setAnswers] = useState<string[]>(() => prompts.map(() => ""));
  const originalStory = [experience, ...history.map(item => item.answer)].join("\n");
  const [mode, setMode] = useState<"add" | "correct">("add");
  const [correctedStory, setCorrectedStory] = useState(originalStory);
  const [confirming, setConfirming] = useState(false);
  const additions = answers.flatMap((answer, index) => answer.trim() ? [{ question: prompts[index], answer: answer.trim() }] : []);
  const combined = [...history, ...additions];
  const characterCount = experience.length + combined.reduce((sum, item) => sum + item.answer.length, 0);
  const tooLong = characterCount > 1500 || combined.length > 12;
  return <section className="study-panel followup-panel" aria-labelledby="followup-title">
    <h3 id="followup-title">{questions.length ? "조금 더 들려주세요" : "이야기를 더해 노트 다듬기"}</h3>
    <div className="study-options" role="group" aria-label="이야기 수정 방식">
      <button className="secondary" disabled={loading} aria-pressed={mode === "add"} onClick={() => setMode("add")}>정보 추가</button>
      <button className="secondary" disabled={loading} aria-pressed={mode === "correct"} onClick={() => setMode("correct")}>기존 내용 정정</button>
    </div>
    <p>{mode === "add" ? "새로운 사실만 추가해 주세요. 기존 시간·인물 등을 바꾸려면 ‘기존 내용 정정’을 선택하세요." : "최종적으로 맞는 이야기 전체를 적어주세요. 이 내용으로 기존 원문과 추가 답변을 교체하며, 이전 기록은 모델에 보내지 않습니다."}</p>
    <details className="source-story"><summary>현재 노트의 원문 보기</summary><p>{experience}</p>{history.map((item, index) => <p key={index}><strong>{item.question}</strong><br />{item.answer}</p>)}</details>
    {mode === "add" ? <form onSubmit={(event) => { event.preventDefault(); if (additions.length && !tooLong && !loading) onSubmit(combined); }}>
      <fieldset disabled={loading}>
        {prompts.map((question, index) => <div className="followup-field" key={index}>
          <label htmlFor={`followup-${index}`}>{question}</label>
          <textarea id={`followup-${index}`} rows={3} maxLength={1500} value={answers[index]} onChange={(event) => {
            const next = answers.map((value, i) => i === index ? event.target.value : value);
            setAnswers(next); onDirty(next.some(value => !!value.trim()) || correctedStory !== originalStory);
          }} placeholder="‘네/아니요’만 적기보다 실제 내용을 문장으로 적어주세요." />
        </div>)}
        <p className="footnote">원문과 추가 답변 합계 {characterCount.toLocaleString()} / 1,500자</p>
        {tooLong && <p role="alert" className="error">원문과 답변은 합계 1,500자, 추가 답변은 최대 12개까지 가능해요. 답변을 줄이거나 이전 화면에서 원문을 정리해 주세요.</p>}
        <button className="primary" type="submit" disabled={!additions.length || tooLong || loading}>{loading ? "보완한 노트 만드는 중…" : "답변을 더해 노트 다시 만들기"}</button>
        {loading && <p role="status">기존 이야기와 추가 답변으로 노트를 다시 만들고 있어요.</p>}
      </fieldset>
    </form> : <div className="correction-editor">
      <label htmlFor="corrected-story">정정 후 확정할 이야기 전체</label>
      <textarea id="corrected-story" rows={6} maxLength={1500} disabled={loading} value={correctedStory} onChange={(event) => {
        const next = event.target.value; setCorrectedStory(next); setConfirming(false);
        onDirty(next !== originalStory || answers.some(value => !!value.trim()));
      }} />
      <p className="footnote">{correctedStory.trim().length} / 1,500자 · 과거의 잘못된 내용은 지우고 올바른 사실만 남겨주세요.</p>
      {!confirming ? <button className="primary" disabled={loading || correctedStory.trim().length < 5 || correctedStory.trim().length > 1500 || correctedStory.trim() === originalStory.trim()} onClick={() => setConfirming(true)}>최종 이야기 확인</button> : <div className="correction-preview">
        <strong>다음 생성에 사용할 사실</strong><p>{correctedStory.trim()}</p>
        <p className="footnote">이 내용만 경험 사실로 모델에 전달됩니다. 기존 내용은 성공 후 이전 노트 이력에 보관합니다.</p>
        <button className="primary" disabled={loading} onClick={() => onCorrect(correctedStory.trim())}>{loading ? "정정한 노트 만드는 중…" : "이 이야기로 확정하고 재생성"}</button>
      </div>}
    </div>}
    {error && <p role="alert" className="error">{error} 기존 노트와 작성 중인 내용은 그대로 있어요.</p>}
  </section>;
}
