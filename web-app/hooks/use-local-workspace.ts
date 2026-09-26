"use client";
import { useEffect, useRef, useState } from "react";
import { WORKSPACE_KEY, WorkspaceStorageError, removeWorkspace, saveWorkspace, withWorkspaceStorage, type WorkspaceData, type WorkspaceLoad } from "@/lib/local-workspace";

type Mode = "off" | "on" | "invalid" | "error" | "conflict";
const messages = {
  conflict: "다른 탭에서 기록이 바뀌어 자동 저장을 멈췄어요. 현재 화면은 유지됩니다. 다른 탭을 확인한 뒤 새로고침해 주세요.",
  unavailable: "브라우저 저장소에 접근할 수 없어요. 현재 화면은 유지됩니다. JSON 파일로 노트를 보관해 주세요.",
  full: "브라우저 저장 공간이 부족해요. 마지막 저장 기록과 현재 화면은 유지됩니다. JSON 파일 저장을 이용해 주세요.",
  invalid: "자동 저장 기록이나 입력 형식을 확인하지 못했어요. 기존 기록은 덮어쓰지 않았어요.",
};

export function useLocalWorkspace(data: WorkspaceData, initial: WorkspaceLoad) {
  const content = JSON.stringify(data);
  const [mode, setMode] = useState<Mode>(initial.kind === "ready" ? "on" : initial.kind === "invalid" ? "invalid" : initial.kind === "unavailable" ? "error" : "off");
  const [message, setMessage] = useState(initial.kind === "invalid" ? messages.invalid : initial.kind === "unavailable" ? messages.unavailable : "");
  const [savedContent, setSavedContent] = useState(initial.record ? JSON.stringify(initial.record.data) : "");
  const [savedAt, setSavedAt] = useState(initial.record?.savedAt ?? "");
  const token = useRef(initial.raw);
  const active = useRef(initial.kind === "ready");

  function fail(error: unknown, prefix = "") {
    active.current = false;
    const code = error instanceof WorkspaceStorageError ? error.code : "unavailable";
    setMode(code === "conflict" ? "conflict" : "error");
    setMessage(prefix + messages[code]);
  }

  useEffect(() => {
    if (mode !== "on" || content === savedContent) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void withWorkspaceStorage(storage => {
        if (cancelled || !active.current) return null;
        const raw = saveWorkspace(storage, token.current, JSON.parse(content));
        token.current = raw;
        return JSON.parse(raw).savedAt as string;
      }).then(date => {
        if (!cancelled && date) { setSavedContent(content); setSavedAt(date); setMessage(""); }
      }).catch(error => {
        // Even if a newer input cancelled this write, a real storage failure must stop subsequent writes.
        if (active.current) fail(error);
      });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [content, mode, savedContent]);

  useEffect(() => {
    let cancelled = false;
    const changed = (event: StorageEvent) => {
      if ((event.key === WORKSPACE_KEY || event.key === null) && event.newValue !== token.current) {
        fail(new WorkspaceStorageError("conflict"));
      }
    };
    window.addEventListener("storage", changed);
    // Also catch a write that happened between the initial read and listener registration.
    void withWorkspaceStorage(storage => storage.getItem(WORKSPACE_KEY)).then(raw => {
      if (!cancelled && raw !== token.current) fail(new WorkspaceStorageError("conflict"));
    }).catch(() => { /* The initial load and actual writes report storage access failures. */ });
    return () => { cancelled = true; window.removeEventListener("storage", changed); };
  }, []);

  function enable() {
    if (mode === "invalid" || mode === "conflict") return;
    active.current = true; setSavedContent(""); setMessage(""); setMode("on");
  }

  async function forget() {
    active.current = false; setMode("off");
    try {
      await withWorkspaceStorage(storage => { removeWorkspace(storage, token.current); token.current = null; });
      setSavedContent(""); setSavedAt(""); setMessage("");
      return true;
    } catch (error) { fail(error, "저장 기록을 지우지 못했어요. "); return false; }
  }

  return { mode, message, savedAt, currentSaved: mode === "on" && savedContent === content, enable, forget };
}
