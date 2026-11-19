// Client for POST /api/analyze/stream (newline-delimited JSON) with a
// fallback to the one-shot POST /api/analyze.
import type { StreamEvent } from "./liveProgress";

/** The backend itself reported a failure -- show it; don't retry. */
export class AnalysisError extends Error {}

/** Streaming isn't available (network error, older backend, no readable
 * body, stream cut off before the result) -- fall back to /api/analyze. */
export class StreamUnavailable extends Error {}

const GENERIC_ERROR = "Analysis service could not complete this request.";
// An older backend without the stream route answers these.
const NO_STREAM_ROUTE = new Set([404, 405, 501]);

function isAbort(err: unknown): boolean {
  return err instanceof DOMException ? err.name === "AbortError" : (err as Error)?.name === "AbortError";
}

async function errorFrom(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || GENERIC_ERROR;
  } catch {
    return GENERIC_ERROR;
  }
}

export async function streamAnalysis(
  apiBase: string,
  body: unknown,
  onEvent: (event: StreamEvent) => void,
  { fetchImpl = fetch, signal }: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(`${apiBase}/api/analyze/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new StreamUnavailable(`stream request failed: ${(err as Error)?.message ?? err}`);
  }

  if (!res.ok) {
    if (NO_STREAM_ROUTE.has(res.status)) throw new StreamUnavailable(`stream route returned ${res.status}`);
    throw new AnalysisError(await errorFrom(res));
  }
  const reader = res.body && typeof res.body.getReader === "function" ? res.body.getReader() : null;
  if (!reader) throw new StreamUnavailable("response body is not readable as a stream");

  const decoder = new TextDecoder();
  let buffered = "";
  const handleLine = (line: string): { report: unknown } | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    let event: StreamEvent;
    try {
      event = JSON.parse(trimmed);
    } catch {
      return null; // not a JSON line (e.g. a proxy comment) -- skip it
    }
    if ("type" in event) {
      if (event.type === "result") return { report: event.report };
      if (event.type === "error") throw new AnalysisError(event.error || GENERIC_ERROR);
      return null; // keepalive
    }
    onEvent(event);
    return null;
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split("\n");
      buffered = done ? "" : lines.pop() ?? "";
      for (const line of lines) {
        const result = handleLine(line);
        if (result) return result.report;
      }
      if (done) break;
    }
  } catch (err) {
    if (err instanceof AnalysisError || isAbort(err)) throw err;
    throw new StreamUnavailable(`stream broke: ${(err as Error)?.message ?? err}`);
  }
  throw new StreamUnavailable("stream ended before the report arrived");
}

export async function postAnalysis(
  apiBase: string,
  body: unknown,
  { fetchImpl = fetch, signal }: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<unknown> {
  const res = await fetchImpl(`${apiBase}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new AnalysisError(await errorFrom(res));
  return res.json();
}

export type ProgressMode = "live" | "timer";

/** Streams real progress; if streaming isn't possible, calls onFallback
 * (switch the UI to timer mode) and runs the one-shot /api/analyze. */
export async function runAnalysis(opts: {
  apiBase: string;
  body: unknown;
  onEvent: (event: StreamEvent) => void;
  onFallback: (reason: string) => void;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<{ report: unknown; mode: ProgressMode }> {
  const { apiBase, body, onEvent, onFallback, fetchImpl, signal } = opts;
  try {
    return { report: await streamAnalysis(apiBase, body, onEvent, { fetchImpl, signal }), mode: "live" };
  } catch (err) {
    if (!(err instanceof StreamUnavailable)) throw err;
    onFallback(err.message);
    return { report: await postAnalysis(apiBase, body, { fetchImpl, signal }), mode: "timer" };
  }
}
