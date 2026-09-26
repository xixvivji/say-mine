"use client";
import { useState } from "react";
import type { useLocalWorkspace } from "@/hooks/use-local-workspace";

export function LocalSave({ local, disabled }: { local: ReturnType<typeof useLocalWorkspace>; disabled: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const status = local.mode === "on" ? (local.currentSaved ? "이 브라우저에 저장됨" : "저장 중…") : local.mode === "off" ? "자동 저장 꺼짐" : "자동 저장 중지";
  return <section className="local-save" aria-label="브라우저 자동 저장">
    <div className="local-save-heading"><strong>이 브라우저에서 이어하기</strong><span role="status">{status}</span></div>
    <p>켜면 설문·경험 입력, 생성된 노트와 복습 완료 이력을 이 브라우저에만 보관해요. 같은 주소로 다시 열면 복원돼요.</p>
    <p className="footnote">공용 기기에서는 켜지 마세요. 작성 중인 보완 답변·정정문과 말하기 타이머는 저장하지 않아요. 브라우저 데이터 삭제 시 기록도 사라지므로 중요한 노트는 JSON으로 백업해 주세요.</p>
    {local.savedAt && <p className="footnote">마지막 저장: {new Date(local.savedAt).toLocaleString("ko-KR")}</p>}
    {local.message && <p role="alert" className="error">{local.message}</p>}
    <div className="study-options">
      {(local.mode === "off" || local.mode === "error") && <button className="secondary" disabled={disabled || removing} onClick={local.enable}>{local.mode === "off" ? "이 브라우저에 자동 저장 켜기" : "저장 다시 시도"}</button>}
      {local.mode !== "off" && local.mode !== "conflict" && <button className="secondary" disabled={disabled || removing} onClick={() => setConfirm(true)}>자동 저장 끄고 기록 지우기</button>}
    </div>
    {confirm && <div className="correction-preview">
      <p>이 주소에 저장한 say.mine 입력·노트·이전 기록을 지우고 자동 저장을 꺼요. 삭제한 브라우저 기록은 복구할 수 없어요. 현재 화면과 내려받은 JSON 파일은 그대로 남아요.</p>
      <button className="secondary" disabled={disabled || removing} onClick={async () => {
        setRemoving(true);
        if (await local.forget()) setConfirm(false);
        setRemoving(false);
      }}>{removing ? "지우는 중…" : "기록 삭제하고 끄기"}</button>
      <button className="secondary" disabled={removing} onClick={() => setConfirm(false)}>취소</button>
    </div>}
  </section>;
}
