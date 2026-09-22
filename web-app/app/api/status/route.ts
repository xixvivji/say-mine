import { backendUrl } from "@/lib/generate";
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const response = await fetch(`${backendUrl()}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error("unavailable");
    return Response.json(await response.json(), { headers });
  } catch {
    return Response.json(
      { ready: false, label: "Python 서버 실행 필요" },
      { headers },
    );
  }
}
