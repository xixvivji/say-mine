"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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
  statusSchema,
  errorSchema,
  type Survey,
  type Note,
} from "@/lib/study";
const steps = ["나의 배경", "나의 이야기", "말하기 노트"];
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
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Survey>({
    work: "",
    student: "",
    home: "",
    level: levels[0],
    target: "미정",
    topics: [],
    topic: "",
    type: "경험 이야기",
    experience: "",
  });
  const [note, setNote] = useState<Note | null>(null);
  const [generationMode, setGenerationMode] = useState("llm");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState("연결 확인 중");
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
  async function generate() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const raw = await response.json();
      if (!response.ok)
        throw new Error(
          errorSchema.safeParse(raw).data?.error ||
            "생성하지 못했습니다. 다시 시도해 주세요.",
        );
      const data = generationSchema.parse(raw);
      setNote(data.note);
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
    return note
      ? `# ${form.topic} · ${form.type}\n\n${note.question}\n\n${note.outline.join(" → ")}\n\n${note.answer}\n\n${note.phrases.map((p) => `${p.english} — ${p.korean}`).join("\n")}\n\n${note.keywords.join(", ")}\n\n${note.variations.join("\n")}\n\n${note.missing_details.join("\n")}\n\n${note.tip}`
      : "";
  }
  function downloadNote() {
    const url = URL.createObjectURL(
      new Blob([noteText()], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "say-mine-note.txt";
    anchor.hidden = true;
    document.body.appendChild(anchor);
    try {
      anchor.click();
      setNotice(
        "다운로드를 요청했어요. 파일이 보이지 않으면 브라우저의 다운로드 목록을 확인하거나 노트를 복사해 주세요.",
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
                  onChange={(e) => change("experience", e.target.value)}
                />
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
                    onClick={generate}
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
              <div className="answer" lang="en">
                {note.answer}
              </div>
              <p className="footnote">
                사실과 다른 부분은 내 경험에 맞게 바꿔주세요. 대괄호는 직접 채울
                부분이에요.
              </p>
              <div className="keyword-card">
                <strong>대본을 가리고 이 키워드로 말해보세요</strong>
                <p lang="en">{note.keywords.join(" · ")}</p>
              </div>
              {note.missing_details.length > 0 && (
                <div className="clarifications">
                  <strong>더 알려주면 좋은 내용</strong>
                  <ul>
                    {note.missing_details.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                  <p>
                    아래 ‘다른 이야기 연습하기’에서 경험을 보완할 수 있어요.
                  </p>
                </div>
              )}
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
                <button className="secondary" onClick={downloadNote}>
                  <Download size={17} /> 파일 저장
                </button>
              </div>
              <p role="status">{notice}</p>
              <div className="actions">
                <button
                  className="secondary"
                  onClick={() => {
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
