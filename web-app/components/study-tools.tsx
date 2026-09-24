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
    {note.variants[selected] ? <p className="comparison-answer" lang="en">{note.variants[selected]}</p> : <p role="status">이 수준의 초안은 검증을 통과하지 못해 표시하지 않았어요.</p>}
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

export function Followup({ questions, experience, history, loading, error, onSubmit }: {
  questions: string[]; experience: string; history: Clarification[]; loading: boolean; error: string; onSubmit: (clarifications: Clarification[]) => void;
}) {
  const prompts = questions.length ? questions : ["추가하거나 더 구체적으로 설명할 내용이 있나요?"];
  const [answers, setAnswers] = useState<string[]>(() => prompts.map(() => ""));
  const additions = answers.flatMap((answer, index) => answer.trim() ? [{ question: prompts[index], answer: answer.trim() }] : []);
  const combined = [...history, ...additions];
  const characterCount = experience.length + combined.reduce((sum, item) => sum + item.answer.length, 0);
  const tooLong = characterCount > 1500 || combined.length > 12;
  return <section className="study-panel followup-panel" aria-labelledby="followup-title">
    <h3 id="followup-title">{questions.length ? "조금 더 들려주세요" : "이야기를 더해 노트 다듬기"}</h3>
    <p>답한 내용을 기존 이야기에 더해 새 노트를 만들어요. 기억나는 질문에만 답해도 괜찮아요.</p>
    <details className="source-story"><summary>현재 노트의 원문 보기</summary><p>{experience}</p>{history.map((item, index) => <p key={index}><strong>{item.question}</strong><br />{item.answer}</p>)}</details>
    <form onSubmit={(event) => { event.preventDefault(); if (additions.length && !tooLong && !loading) onSubmit(combined); }}>
      <fieldset disabled={loading}>
        {prompts.map((question, index) => <div className="followup-field" key={index}>
          <label htmlFor={`followup-${index}`}>{question}</label>
          <textarea id={`followup-${index}`} rows={3} maxLength={1500} value={answers[index]} onChange={(event) => setAnswers((values) => values.map((value, i) => i === index ? event.target.value : value))} placeholder="실제로 기억하는 내용을 한국어로 적어주세요." />
        </div>)}
        <p className="footnote">원문과 추가 답변 합계 {characterCount.toLocaleString()} / 1,500자</p>
        {tooLong && <p role="alert" className="error">원문과 답변은 합계 1,500자, 추가 답변은 최대 12개까지 가능해요. 답변을 줄이거나 이전 화면에서 원문을 정리해 주세요.</p>}
        {error && <p role="alert" className="error">{error} 기존 노트와 추가 답변은 그대로 있어요.</p>}
        <button className="primary" type="submit" disabled={!additions.length || tooLong || loading}>{loading ? "보완한 노트 만드는 중…" : "답변을 더해 노트 다시 만들기"}</button>
        {loading && <p role="status">기존 이야기와 추가 답변으로 노트를 다시 만들고 있어요.</p>}
      </fieldset>
    </form>
  </section>;
}
