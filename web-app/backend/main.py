"""Local-only API. Start from project root: python -m uvicorn backend.main:app --port 8000."""

import asyncio
import os
import threading
from pathlib import Path
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from .core import Survey, create_chain, load_knowledge, generation_mode, MODEL

app = FastAPI(title="say.mine", docs_url="/docs")
model = os.environ.get("OLLAMA_MODEL", MODEL)
base_url = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
chain = create_chain(
    load_knowledge(Path(__file__).with_name("knowledge.md")), model, base_url
)
generation_lock = threading.Lock()


def reply(data, status=200):
    return JSONResponse(data, status_code=status, headers={"Cache-Control": "no-store"})


@app.get("/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            response = await client.get(base_url + "/api/tags")
            response.raise_for_status()
            ready = any(item["name"] == model for item in response.json()["models"])
        return reply(
            dict(ready=ready, label="AI 연결됨" if ready else "모델 설치 필요")
        )
    except Exception:
        return reply(dict(ready=False, label="Ollama 실행 필요"))


def run_generation(data):
    # Release inside worker so disconnect/cancellation cannot start overlapping generations.
    try:
        note = chain.invoke(data)
        return {"note": note.model_dump(), "mode": generation_mode(data)}
    finally:
        generation_lock.release()


@app.post("/generate")
async def generate(request: Request):
    # Browser calls go through the same-origin frontend proxy, which does not forward Origin.
    if request.headers.get("origin"):
        return reply({"error": "웹 화면의 생성 버튼을 사용해 주세요."}, 403)
    if (
        request.headers.get("content-type", "").split(";")[0].strip().lower()
        != "application/json"
    ):
        return reply({"error": "JSON 입력이 필요합니다."}, 415)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 16000:
            return reply({"error": "입력이 너무 큽니다."}, 413)
    try:
        data = Survey.model_validate_json(bytes(body)).model_dump()
    except (ValidationError, ValueError):
        return reply(
            {"error": "설문과 선택 주제를 확인하고 경험을 5–1,500자로 입력해 주세요."},
            400,
        )
    if not generation_lock.acquire(blocking=False):
        return reply(
            {"error": "다른 노트를 생성 중입니다. 잠시 후 다시 시도해 주세요."}, 429
        )
    try:
        return reply(await asyncio.to_thread(run_generation, data))
    except Exception:
        return reply(
            {
                "error": "생성 또는 출력 검증에 실패했습니다. 입력은 유지됩니다. Ollama 상태를 확인하거나 경험을 더 구체적으로 적어 주세요."
            },
            503,
        )
