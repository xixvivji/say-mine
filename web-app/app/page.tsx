"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SpeakingPractice, AnswerComparison, Followup } from "@/components/study-tools";
import { SessionImport } from "@/components/session-import";
import { LocalSave } from "@/components/local-save";
import { StudyLibrary } from "@/components/study-library";
import { deleteHistoryRecord, toggleFavorite, type RecordId } from "@/lib/library";
import { useLocalWorkspace } from "@/hooks/use-local-workspace";
import { loadBrowserWorkspace, type WorkspaceData, type WorkspaceLoad } from "@/lib/local-workspace";
import { nextHistory, readableSession, replaceStory, sameSurvey, serializeSession, type SavedSession, type Snapshot } from "@/lib/session";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Check,
  MessageCircle,
  Sparkles,
  Copy,
  Download,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  groups,
  types,
  levels,
  targets,
  works,
  students,
  homes,
  guideUrl,
  generationSchema,
  surveySchema,
  statusSchema,
  errorSchema,
  type Survey,
  type Note,
} from "@/lib/study";
const steps = ["나의 배경", "나의 이야기", "말하기 노트"];
const emptySurvey: Survey = {
  work: "", student: "", home: "", level: levels[0], target: "미정",
  topics: [], topic: "", type: "경험 이야기", experience: "", clarifications: [],
};
const levelGuides: Record<string, string> = {
  "짧고 쉬운 문장": "한 문장에 한 가지 내용을 담고, 익숙한 단어로 말해요.",
  "연결해서 설명하기": "입력에 있는 이유·결과·시간 관계를 접속사로 연결해요.",
  "구체적으로 설명하기": "주어진 세부 정보를 수식절과 다양한 문장 구조로 묶어 말해요.",
};
async function connectionLabel() {
  try {
    const response = await fetch("/api/status");
    return statusSchema.parse(await response.json()).label;
  } catch {
    return "연결을 확인해 주세요";
  }
}
function Choice({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="field">
      <legend>{title}</legend>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="choices"
        aria-label={title}
      >
        {options.map((option) => (
          <label
            className={`choice ${value === option ? "selected" : ""}`}
            key={option}
          >
            <RadioGroupItem value={option} />
            {option}
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
export default function Home() {
  const [initial, setInitial] = useState<WorkspaceLoad | null>(null);
  useEffect(() => {
    let active = true;
    void loadBrowserWorkspace().then(value => { if (active) setInitial(value); });
    return () => { active = false; };
  }, []);
  if (!initial) return <main className="main"><p role="status">저장한 학습을 확인하고 있어요…</p></main>;
  return <StudyWorkspace initial={initial} />;
}

function StudyWorkspace({ initial }: { initial: WorkspaceLoad }) {
  const restored = initial.record?.data;
  const [step, setStep] = useState<WorkspaceData["step"]>(restored?.step ?? 0);
  const [form, setForm] = useState<Survey>(restored?.form ?? emptySurvey);
  const [note, setNote] = useState<Note | null>(restored?.current?.note ?? null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(restored?.current ?? null);
  const [history, setHistory] = useState<Snapshot[]>(restored?.history ?? []);
  const [unsaved, setUnsaved] = useState(Boolean(restored?.current));
  const [followupDirty, setFollowupDirty] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [generationMode, setGenerationMode] = useState(restored?.current?.mode ?? "llm");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(restored ? "이 브라우저에 저장한 학습을 복원했어요. 보완 답변 작성창과 타이머는 새로 시작해요." : "");
  const [connection, setConnection] = useState("연결 확인 중");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const local = useLocalWorkspace({ form, step, current: snapshot, history }, initial);
  const formDirty = !sameSurvey(form, snapshot?.input ?? emptySurvey);
  useEffect(() => {
    if ((!unsaved && !formDirty || local.currentSaved) && !followupDirty && !loading) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved, formDirty, followupDirty, loading, local.currentSaved]);
  const change = (key: keyof Survey, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));
  async function checkConnection() {
    setConnection(await connectionLabel());
  }
  useEffect(() => {
    let active = true;
    void connectionLabel().then((label) => {
      if (active) setConnection(label);
    });
    return () => { active = false; };
  }, []);
  async function generate(input: Survey = form, reason: Snapshot["reason"] = "initial") {
    setLoading(true);
    setError("");
    try {
      input = surveySchema.parse(input);
      // Check capacity before a model call; never discard a favorite after generation.
      const archivedHistory = nextHistory(history, snapshot);
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const raw = await response.json();
      if (!response.ok)
        throw new Error(
          errorSchema.safeParse(raw).data?.error ||
            "생성하지 못했습니다. 다시 시도해 주세요.",
        );
      const data = generationSchema.parse(raw);
      setHistory(archivedHistory);
      setSnapshot({ ...data, input, generatedAt: new Date().toISOString(), reason });
      setUnsaved(true);
      setFollowupDirty(false);
      setNote(data.note);
      setForm(input);
      setRevision((value) => value + 1);
      setNotice("");
      setPracticing(false);
      setGenerationMode(data.mode);
      setStep(2);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }
  function noteText() {
    return snapshot ? readableSession(snapshot, history) : "";
  }
  function updateLibrary(id: RecordId, action: "favorite" | "delete") {
    if (loading) return;
    try {
      const records = { current: snapshot, history };
      const updated = action === "favorite" ? toggleFavorite(records, id) : deleteHistoryRecord(records, id);
      setSnapshot(updated.current); setHistory(updated.history); setUnsaved(true);
      setNotice(action === "delete" ? "이전 기록 하나를 삭제했어요. 내려받은 JSON 백업이 있으면 다시 불러올 수 있어요." : "즐겨찾기를 변경했어요.");
    } catch (failure) { setNotice(failure instanceof Error ? failure.message : "기록을 변경하지 못했어요."); }
  }
  function loadSession(session: SavedSession) {
    setSnapshot(session.current); setHistory(session.history);
    setForm(session.current.input); setNote(session.current.note); setGenerationMode(session.current.mode);
    setUnsaved(false); setFollowupDirty(false); setPracticing(false);
    setRevision(value => value + 1); setStep(2); setError("");
    setNotice("저장한 학습을 불러왔어요. 타이머는 새로 시작해요.");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function correctStory(story: string) {
    try { void generate(replaceStory(form, story), "correction"); }
    catch { setError("정정할 이야기는 5–1,500자로 입력해 주세요."); }
  }
  function downloadNote(format: "txt" | "json") {
    if (!snapshot) return;
    let content: string;
    try {
      content = format === "json" ? serializeSession(snapshot, history) : noteText();
    } catch { setNotice("저장할 내용을 확인하지 못했어요. 현재 노트는 유지됩니다."); return; }
    const url = URL.createObjectURL(
      new Blob([content], { type: format === "json" ? "application/json" : "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `say-mine-${format === "json" ? "session" : "note"}.${format}`;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    try {
      anchor.click();
      if (format === "json") setUnsaved(false);
      setNotice(
        "다운로드를 요청했어요. 다운로드 목록에서 파일을 확인해 주세요. 아직 반영하지 않은 입력과 타이머는 저장하지 않아요.",
      );
    } catch {
      setNotice("다운로드를 요청하지 못했어요. 노트 복사를 이용해 주세요.");
    } finally {
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }
  return (
    <div>
      <header className="header">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <MessageCircle size={22} />
          </span>
          say<span className="brand-dot">.</span>mine
        </Link>
        <span className="header-label">MY SPEAKING STUDIO</span>
        <button
          className="beta"
          type="button"
          onClick={() => {
            setConnection("연결 확인 중");
            void checkConnection();
          }}
          title="눌러서 연결 상태 다시 확인"
          aria-label={`연결 상태 다시 확인: ${connection}`}
        >
          {connection} ↻
        </button>
      </header>
      <div className="workspace">
        <aside className="rail">
          <div>
            <p className="eyebrow">YOUR STORY, YOUR WORDS</p>
            <h1>
              내 이야기로
              <br />
              시작하는 영어.
            </h1>
            <p className="rail-desc">
              말할 내용은 이미 내 안에.
              <br />
              이제 영어로 꺼내볼 차례예요.
            </p>
          </div>
          <ol className="steps">
            {steps.map((s, i) => (
              <li
                key={s}
                className={step === i ? "active" : step > i ? "done" : ""}
              >
                <span>{step > i ? <Check size={16} /> : `0${i + 1}`}</span>
                <div>
                  {s}
                  <small>
                    {
                      [
                        "배경과 관심사 선택",
                        "기억에 남는 경험 입력",
                        "나만의 템플릿 완성",
                      ][i]
                    }
                  </small>
                </div>
              </li>
            ))}
          </ol>
          <div className="rail-bottom">
            <BookOpen size={20} />
            <p>
              외울 문장보다,
              <br />
              <strong>다시 꺼내 쓸 이야기.</strong>
            </p>
          </div>
        </aside>
        <main className="main">
          <div className="progress-label">
            <span>STEP 0{step + 1}</span>
            <span>{step + 1} / 3</span>
          </div>
          <div className="progress-track">
            <div style={{ width: `${((step + 1) / 3) * 100}%` }} />
          </div>
          <LocalSave local={local} disabled={loading} />
          <div className="study-options workspace-views" role="group" aria-label="학습 화면 선택">
            <button className="secondary" disabled={loading} aria-pressed={!libraryOpen} onClick={() => setLibraryOpen(false)}>현재 작업</button>
            <button className="secondary" disabled={loading} aria-pressed={libraryOpen} onClick={() => { setLibraryOpen(true); setPracticing(false); setNotice(""); }}>학습 기록 보관함 ({history.length + (snapshot ? 1 : 0)})</button>
          </div>
          {libraryOpen && <StudyLibrary records={{ current: snapshot, history }} disabled={loading} onFavorite={id => updateLibrary(id, "favorite")} onDelete={id => updateLibrary(id, "delete")} onBackup={() => downloadNote("json")} />}
          <div hidden={libraryOpen}>
          {step === 0 && (
            <section>
              <div className="section-head">
                <p className="eyebrow">BACKGROUND SURVEY</p>
                <h2>어떤 이야기를 하고 싶나요?</h2>
                <p>배경과 관심사를 알려주세요.</p>
              </div>
              <Choice
                title="일과 관련한 배경"
                options={works}
                value={form.work}
                onChange={(v) => change("work", v)}
              />
              <Choice
                title="현재 학생인가요?"
                options={students}
                value={form.student}
                onChange={(v) => change("student", v)}
              />
              <Choice
                title="주로 생활하는 공간은"
                options={homes}
                value={form.home}
                onChange={(v) => change("home", v)}
              />
              <p className="topics-caption">
                익숙한 주제를 골라주세요{" "}
                <span>전체 1–12개 · 학습용 선택 기준</span>
              </p>
              {Object.entries(groups).map(([group, options]) => (
                <fieldset className="field" key={group}>
                  <legend>{group}</legend>
                  <div className="topic-grid">
                    {options.map((t) => (
                      <label
                        key={t}
                        className={`topic ${form.topics.includes(t) ? "selected" : ""}`}
                      >
                        <span>{t}</span>
                        <Checkbox
                          aria-label={t}
                          checked={form.topics.includes(t)}
                          disabled={
                            !form.topics.includes(t) && form.topics.length >= 12
                          }
                          onCheckedChange={() =>
                            change(
                              "topics",
                              form.topics.includes(t)
                                ? form.topics.filter((p) => p !== t)
                                : [...form.topics, t],
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <Choice
                title="목표 등급"
                options={targets}
                value={form.target}
                onChange={(v) => change("target", v)}
              />
              <Choice
                title="현재 편하게 말할 수 있는 표현 수준"
                options={levels}
                value={form.level}
                onChange={(v) => change("level", v)}
              />
              <p className="footnote" aria-live="polite">
                {levelGuides[form.level]} 입력한 사실을 유지하는 연습이며, 등급을 보장하지 않아요.
              </p>
              <div className="actions">
                <span>{form.topics.length}개 주제를 골랐어요</span>
                <button
                  className="primary"
                  disabled={
                    !form.topics.length ||
                    !form.work ||
                    !form.student ||
                    !form.home
                  }
                  onClick={() => {
                    change(
                      "topic",
                      form.topics.includes(form.topic)
                        ? form.topic
                        : form.topics[0],
                    );
                    setStep(1);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                >
                  내 이야기 더하기 <ArrowRight size={18} />
                </button>
              </div>
            </section>
          )}
          {step === 1 && (
            <section>
              <fieldset className="generation-fields" disabled={loading}>
                <div className="section-head">
                  <p className="eyebrow">A MOMENT TO REMEMBER</p>
                  <h2>작은 이야기 하나면 충분해요.</h2>
                  <p>한국어로 경험이나 상황을 적어주세요.</p>
                </div>
                <p className="profile-summary">
                  {form.work} · {form.student} · {form.home}
                  <br />
                  목표 {form.target} · {form.level}
                </p>
                <Choice
                  title="이번에 연습할 주제"
                  options={form.topics}
                  value={form.topic}
                  onChange={(v) => change("topic", v)}
                />
                <Choice
                  title="어떻게 말해볼까요?"
                  options={types}
                  value={form.type}
                  onChange={(v) => change("type", v)}
                />
                <div className="writing-guide">
                  <Sparkles size={20} />
                  <div>
                    <strong>
                      {form.type === "묘사"
                        ? "어떤 모습인가요? 평소에는 무엇을 하나요?"
                        : form.type === "롤플레이"
                          ? "누구에게 무엇을 물어보거나 제안하고 싶나요?"
                          : "언제, 누구와, 무엇을 했나요?"}
                    </strong>
                    <p>
                      {form.type === "롤플레이"
                        ? "연습할 가상 상황을 적어도 괜찮아요. 실제 경험과 구분해 주세요."
                        : "기억에 남는 구체적인 내용과 느낀 점을 덧붙여 주세요."}
                    </p>
                  </div>
                </div>
                <label className="text-label" htmlFor="experience">
                  {form.type === "롤플레이"
                    ? "연습할 상황"
                    : "나의 실제 이야기"}
                </label>
                <textarea
                  id="experience"
                  maxLength={1500}
                  rows={8}
                  placeholder="예: 지난 주말 친구와 동네 공원을 걸었어요. 비가 온 뒤라 공기가 시원했고, 벤치에 앉아 한 주 동안 있었던 일을 이야기했어요. 오랜만에 마음이 편안해졌어요."
                  value={form.experience}
                  onChange={(e) => setForm((value) => ({ ...value, experience: e.target.value, clarifications: [] }))}
                />
                {form.clarifications.length > 0 && <p className="footnote">추가 답변 {form.clarifications.length}개가 함께 반영돼요. 원문을 수정하면 기존 추가 답변은 초기화돼요.</p>}
                <div className="input-meta">
                  <span>개인정보 없이 5–1,500자로 입력해 주세요.</span>
                  <span>{form.experience.length} / 1,500</span>
                </div>
                <p className="footnote">
                  25자 미만이면 보완 질문을 먼저 드려요. 더 풍부한 표현을 원하면
                  실제로 기억하는 이유·시간·특징을 적어주세요.
                </p>
                {error && (
                  <div role="alert" className="error">
                    {error}
                  </div>
                )}
                {loading && (
                  <p role="status" className="loading">
                    영어 답변과 연습 카드를 차례로 만들고 있어요. 잠시 기다려 주세요.
                  </p>
                )}
                <div className="actions">
                  <button
                    className="secondary"
                    disabled={loading}
                    onClick={() => setStep(0)}
                  >
                    <ArrowLeft size={17} /> 설문 수정
                  </button>
                  <button
                    className="primary"
                    disabled={loading || form.experience.trim().length < 5}
                    onClick={() => void generate()}
                  >
                    <Sparkles size={18} />
                    {loading ? "노트 만드는 중…" : "내 말하기 노트 만들기"}
                  </button>
                </div>
              </fieldset>
            </section>
          )}
          {step === 2 && note && (
            <section>
              <div className="section-head">
                <p className="eyebrow">YOUR SPEAKING NOTE</p>
                <h2>이번 이야기는, {form.topic}.</h2>
                <p>
                  {form.type} · {form.level} · 목표 {form.target} ·{" "}
                  {generationMode === "llm"
                    ? "AI 생성 연습 자료"
                    : "추가 정보 확인 · 규칙 기반 (AI 미호출)"}
                </p>
              </div>
              {generationMode === "llm" && (
                <div className="practice-entry">
                  <div><strong>내 이야기, 이제 말해볼까요?</strong><p>대본을 조금씩 가리고 기억해서 말해보세요.</p></div>
                  <button className="primary" disabled={loading} onClick={() => setPracticing(!practicing)}>{practicing ? "노트로 돌아가기" : "말하기 연습 시작"}</button>
                </div>
              )}
              {practicing && <SpeakingPractice key={revision} note={note} />}
              <div hidden={practicing}>
              <div className="question">
                <span>연습 질문</span>
                <h3 lang="en">{note.question}</h3>
              </div>
              <h3 className="block-title">
                01 <span>이야기의 뼈대</span>
              </h3>
              <ol className="answer-outline">
                {note.outline.map((o, i) => (
                  <li key={i}>
                    <span>{i + 1}</span>
                    {o}
                  </li>
                ))}
              </ol>
              <h3 className="block-title">
                02 <span>내 이야기로 만든 답변</span>
              </h3>
              <div className="answer" lang="en">{note.answer}</div>
              {generationMode === "llm" && <AnswerComparison key={`comparison-${revision}`} note={note} input={snapshot?.input ?? form} />}
              <p className="footnote">
                사실과 다른 부분은 내 경험에 맞게 바꿔주세요. 대괄호는 직접 채울
                부분이에요.
              </p>
              <div className="keyword-card">
                <strong>대본을 가리고 이 키워드로 말해보세요</strong>
                <p lang="en">{note.keywords.join(" · ")}</p>
              </div>
              <h3 className="block-title">
                03 <span>다시 꺼내 쓸 표현</span>
              </h3>
              <div className="phrases">
                {note.phrases.map((p, i) => (
                  <div key={i}>
                    <strong lang="en">{p.english}</strong>
                    <span>{p.korean}</span>
                  </div>
                ))}
              </div>
              <h3 className="block-title">
                04 <span>한 번 더 말해보기</span>
              </h3>
              <ul className="variations">
                {note.variations.map((q, i) => (
                  <li key={i} lang="en">
                    {q}
                  </li>
                ))}
              </ul>
              <p className="tip">{note.tip}</p>
              <Followup key={`followup-${revision}`} questions={note.missing_details} experience={form.experience} history={form.clarifications} loading={loading} error={error} onSubmit={(clarifications) => void generate({ ...form, clarifications }, "addition")} onCorrect={correctStory} onDirty={setFollowupDirty} />
              <div className="export-actions">
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(noteText());
                      setNotice("노트를 복사했어요.");
                    } catch {
                      setNotice("복사하지 못했어요. 파일로 저장해 주세요.");
                    }
                  }}
                >
                  <Copy size={17} /> 노트 복사
                </button>
                <button className="secondary" onClick={() => downloadNote("txt")}>
                  <Download size={17} /> 읽기용 TXT
                </button>
                <button className="primary" onClick={() => downloadNote("json")}>
                  <Download size={17} /> 이어하기용 JSON
                </button>
              </div>
              <p className="footnote">설문·확정한 이야기·세 수준 답변과 이전 노트 최대 10개를 JSON에 저장해요. 이전 기록은 모델에 전송하지 않아요. 개인정보가 담길 수 있으니 공유 전에 확인해 주세요.</p>
              </div>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={loading}
                  onClick={() => {
                    if (followupDirty && !window.confirm("아직 반영하지 않은 추가 답변·정정 내용은 사라집니다. 이야기 입력으로 이동할까요?")) return;
                    setFollowupDirty(false);
                    setPracticing(false);
                    setStep(1);
                    setError("");
                    setNotice("");
                  }}
                >
                  <ArrowLeft size={17} /> 다른 이야기 연습하기
                </button>
              </div>
            </section>
          )}
          <SessionImport disabled={loading} onLoad={loadSession} />
          </div>
          <p role="status">{notice}</p>
          <footer>
            <span>say.mine · 공식 OPIc 서비스와 무관한 학습 도구</span>
            <a href={guideUrl} target="_blank" rel="noreferrer">
              참고: OPIc 가이드 ↗
            </a>
            <p>학습용 설문이며 공식 기출·채점·등급 보장 기능은 아닙니다.</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
