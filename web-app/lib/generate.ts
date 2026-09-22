// Browser-facing API routes proxy to the canonical Python LangChain backend.
// There is intentionally no second TypeScript prompt or model invocation.
export function backendUrl() {
  const url = process.env.OPIC_BACKEND_URL || "http://127.0.0.1:8000";
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw new Error("Loopback backend required");
  return url.replace(/\/$/, "");
}
