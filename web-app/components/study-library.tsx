"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Download, Star, Trash2 } from "lucide-react";
import { AnswerComparison, SpeakingPractice } from "@/components/study-tools";
import { filterLibrary, libraryEntries, type RecordId, type StudyRecords } from "@/lib/library";
import { MAX_HISTORY, storyFacts } from "@/lib/session";

const reasonLabels = { initial: "새 이야기", addition: "정보 추가", correction: "내용 정정" };
const dateLabel = (value: string) => new Date(value).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });

export function StudyLibrary({ records, disabled, onFavorite, onDelete, onBackup }: {
  records: StudyRecords; disabled: boolean;
  onFavorite: (id: RecordId) => void; onDelete: (id: RecordId) => void; onBackup: () => void;
}) {
  const [topic, setTopic] = useState("");
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<RecordId | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecordId | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const entries = libraryEntries(records);
  const topics = [...new Set([...entries.map(entry => entry.snapshot.input.topic), ...(topic ? [topic] : [])])].sort((a, b) => a.localeCompare(b, "ko"));
  const filtered = filterLibrary(entries, topic, search, favoritesOnly);
  const reviewing = entries.find(entry => entry.id === selected);
  const deleting = entries.find(entry => entry.id === pendingDelete);
  useEffect(() => { heading.current?.focus(); }, [selected]);

  if (reviewing) {
    const { snapshot } = reviewing;
    return <section className="library-review" aria-labelledby="library-review-title">
      <button className="secondary" onClick={() => setSelected(null)}><ArrowLeft size={17} /> 기록 목록으로</button>
      <div className="section-head">
        <p className="eyebrow">REVISIT YOUR STORY</p>
        <h2 id="library-review-title" ref={heading} tabIndex={-1}>{snapshot.input.topic} {snapshot.mode === "llm" ? "다시 말하기" : "기록 보기"}</h2>
        <p>{dateLabel(snapshot.generatedAt)} · {snapshot.input.type} · {snapshot.input.level}</p>
      </div>
      <p className="profile-summary">저장된 노트로 복습해요. 모델을 다시 호출하지 않으며 현재 작성 중인 입력도 바꾸지 않아요. 복습을 나가면 타이머와 완료 표시는 초기화돼요.</p>
      <details className="source-story"><summary>이 기록의 원문 보기</summary><p>{storyFacts(snapshot.input)}</p></details>
      {snapshot.mode === "llm" ? <>
        <SpeakingPractice key={String(selected)} note={snapshot.note} />
        <AnswerComparison key={`compare-${selected}`} note={snapshot.note} input={snapshot.input} />
        <p className="footnote">AI가 생성한 학습 자료예요. 내 경험과 다른 내용이 없는지 확인하세요. 공식 채점 결과가 아니에요.</p>
      </> : <div className="study-panel">
        <h3>추가 정보가 필요한 기록이에요</h3>
        <p>영어 답변 생성 전 보완 질문을 받은 기록이라 말하기 복습은 제공하지 않아요.</p>
        <ul>{snapshot.note.missing_details.map((question, index) => <li key={index}>{question}</li>)}</ul>
      </div>}
    </section>;
  }

  return <section className="study-library" aria-labelledby="library-title">
    <div className="section-head">
      <p className="eyebrow">YOUR STORY LIBRARY</p>
      <h2 id="library-title" ref={heading} tabIndex={-1}>쌓아 둔 이야기, 다시 꺼내기.</h2>
      <p>주제를 골라 찾고, 키워드만 보며 다시 말해보세요.</p>
    </div>
    <p className="footnote">현재 노트와 이전 {MAX_HISTORY}개까지 보관해요. 새 노트를 만들 때 한도를 넘으면 즐겨찾기를 제외한 오래된 이전 기록부터 정리해요. 모두 즐겨찾기면 먼저 공간을 비워 주세요.</p>
    <p className="footnote">자동 저장이 꺼져 있으면 이 화면에서만 유지돼요. 삭제·교체 전 중요한 기록은 JSON으로 백업하세요. 현재 작업 중인 노트는 여기서 삭제하지 않아요.</p>
    <div className="library-filters">
      <label htmlFor="library-topic">주제<select id="library-topic" value={topic} onChange={event => { setTopic(event.target.value); setPendingDelete(null); }}>
        <option value="">전체 주제</option>{topics.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <label htmlFor="library-search">이야기 찾기<input id="library-search" type="search" maxLength={200} value={search} onChange={event => { setSearch(event.target.value); setPendingDelete(null); }} placeholder="원문·영어 답변에서 검색" /></label>
    </div>
    <div className="study-options">
      <button className="secondary" aria-pressed={favoritesOnly} onClick={() => { setFavoritesOnly(!favoritesOnly); setPendingDelete(null); }}><Star size={16} /> 즐겨찾기만</button>
      <button className="secondary" disabled={disabled || !records.current} onClick={onBackup}><Download size={16} /> 전체 기록 JSON 백업</button>
    </div>
    <p className="library-count" role="status">전체 {entries.length}개 중 {filtered.length}개 · 생성일 최신순</p>
    {!filtered.length && <div className="library-empty"><BookOpen size={28} /><p>{entries.length ? "조건에 맞는 기록이 없어요." : "첫 이야기를 만들면 여기에 쌓여요."}</p>
      {entries.length > 0 && <button className="secondary" onClick={() => { setTopic(""); setSearch(""); setFavoritesOnly(false); }}>필터 초기화</button>}
    </div>}
    <ul className="library-grid">
      {filtered.map(({ id, snapshot }) => <li key={String(id)} className="library-card">
        <div className="library-card-top"><span>{id === "current" ? "현재 노트" : reasonLabels[snapshot.reason]}</span><button className="secondary" disabled={disabled} aria-pressed={!!snapshot.favorite} aria-label={`${snapshot.input.topic} ${dateLabel(snapshot.generatedAt)} 즐겨찾기`} onClick={() => { setPendingDelete(null); onFavorite(id); }}><Star size={17} fill={snapshot.favorite ? "currentColor" : "none"} /><span className="sr-only">즐겨찾기</span></button></div>
        <h3>{snapshot.input.topic}</h3>
        <time dateTime={snapshot.generatedAt}>{dateLabel(snapshot.generatedAt)}</time>
        <p className="library-meta">{snapshot.input.type} · {snapshot.input.level}</p>
        <p className="library-excerpt">{storyFacts(snapshot.input)}</p>
        <div className="library-card-actions">
          <button className="primary" disabled={disabled} onClick={() => { setPendingDelete(null); setSelected(id); }}>{snapshot.mode === "llm" ? "이 기록으로 복습" : "보완 질문 보기"}</button>
          {id !== "current" && <button className="secondary" disabled={disabled} aria-label={`${snapshot.input.topic} ${dateLabel(snapshot.generatedAt)} 기록 삭제`} onClick={() => setPendingDelete(id)}><Trash2 size={16} /> 삭제</button>}
        </div>
        {deleting?.id === id && <div className="correction-preview" role="group" aria-label="기록 삭제 확인">
          <p>{snapshot.favorite ? "즐겨찾기한 기록이에요. " : ""}이 기록을 삭제할까요? 자동 저장이 켜져 있으면 브라우저 저장에도 반영돼요. 되돌릴 수 없지만 내려받은 JSON 파일은 유지돼요.</p>
          <div className="study-options"><button className="secondary" disabled={disabled} onClick={() => { onDelete(id); setPendingDelete(null); }}>이 기록 삭제 확정</button><button className="secondary" onClick={() => setPendingDelete(null)}>취소</button></div>
        </div>}
      </li>)}
    </ul>
  </section>;
}
