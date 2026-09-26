"use client";
import { useState } from "react";
import { MAX_BACKUP_BYTES, parseSession, type SavedSession } from "@/lib/session";

export function SessionImport({ disabled, onLoad }: { disabled: boolean; onLoad: (session: SavedSession) => void }) {
  const [pending, setPending] = useState<SavedSession | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  return <section className="session-import" aria-label="저장한 학습 불러오기">
    <label htmlFor="session-file">저장한 학습 이어하기 · JSON</label>
    <input id="session-file" type="file" accept=".json,application/json" disabled={disabled || reading} onChange={async (event) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;
      setError(""); setPending(null); setReading(true);
      try {
        if (file.size > MAX_BACKUP_BYTES) throw new Error("JSON 파일은 2MB 이내로 선택해 주세요.");
        setPending(parseSession(await file.text()));
      } catch (failure) { setError(failure instanceof Error ? failure.message : "파일을 읽지 못했어요."); }
      finally { setReading(false); input.value = ""; }
    }} />
    {error && <p role="alert" className="error">{error} 현재 입력은 변경하지 않았어요.</p>}
    {pending && <div className="import-preview">
      <p><strong>{pending.current.input.topic}</strong> · {pending.current.input.level} · 이전 노트 {pending.history.length}개</p>
      <p>불러오면 현재 입력과 연습 상태를 이 파일의 기록으로 교체합니다. 저장하지 않은 작성 내용은 사라져요.</p>
      <button className="primary" disabled={disabled} onClick={() => { onLoad(pending); setPending(null); }}>이 기록으로 교체하여 불러오기</button>
      <button className="secondary" disabled={disabled} onClick={() => setPending(null)}>취소</button>
    </div>}
    <p className="footnote">파일은 이 브라우저에서만 읽어요. 정정 전 기록까지 포함될 수 있으니 공유 전에 내용을 확인하세요.</p>
  </section>;
}
