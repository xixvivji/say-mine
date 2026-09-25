import { backendUrl } from "@/lib/generate";
import { surveySchema, generationSchema, errorSchema } from "@/lib/study";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "같은 사이트에서 요청해 주세요." },
      { status: 403, headers },
    );
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    return Response.json(
      { error: "JSON 입력이 필요합니다." },
      { status: 415, headers },
    );
  let body;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("empty");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 32000) {
        await reader.cancel();
        return Response.json(
          { error: "입력이 너무 큽니다." },
          { status: 413, headers },
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    body = surveySchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return Response.json(
      { error: "입력 형식을 확인해 주세요." },
      { status: 400, headers },
    );
  }
  if (!body.success)
    return Response.json(
      {
        error:
          "설문과 선택 주제를 확인하고 이야기를 5–1,500자로 입력해 주세요.",
      },
      { status: 400, headers },
    );
  try {
    const response = await fetch(`${backendUrl()}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.data),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(240000)]),
    });
    const data = await response.json();
    if (!response.ok)
      return Response.json(
        {
          error:
            errorSchema.safeParse(data).data?.error || "생성에 실패했습니다.",
        },
        { status: response.status, headers },
      );
    return Response.json(generationSchema.parse(data), { headers });
  } catch {
    return Response.json(
      {
        error:
          "Python 서버·Ollama 연결 또는 출력 검증에 실패했어요. 입력은 그대로 유지됩니다.",
      },
      { status: 503, headers },
    );
  }
}
