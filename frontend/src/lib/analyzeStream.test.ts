import test from "node:test";
import assert from "node:assert/strict";
import { AnalysisError, StreamUnavailable, runAnalysis, streamAnalysis } from "./analyzeStream";

const REPORT = { stage: "finalizing", results: { pestel: { text: "x" } } };

/** A Response whose body yields `chunks` -- deliberately split mid-line. */
function streamResponse(chunks: string[], init: ResponseInit = { status: 200 }) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, { ...init, headers: { "Content-Type": "application/x-ndjson" } });
}

function fakeFetch(routes: Record<string, () => Response | Promise<Response>>) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    const path = new URL(url).pathname;
    calls.push(path);
    const handler = routes[path];
    if (!handler) throw new TypeError(`no route for ${path}`);
    return handler();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const API = "http://api.test";

test("parses NDJSON split across chunks, skips keepalives, returns the report", async () => {
  const lines = [
    '{"stage":"reading","status":"done"}\n{"stage":"sear',
    'ching","done":1,"total":10}\n{"type":"keepalive"}\n',
    `{"type":"result","report":${JSON.stringify(REPORT)}}\n`,
  ];
  const { impl } = fakeFetch({ "/api/analyze/stream": () => streamResponse(lines) });
  const events: unknown[] = [];
  const report = await streamAnalysis(API, {}, (e) => events.push(e), { fetchImpl: impl });
  assert.deepEqual(report, REPORT);
  assert.deepEqual(events, [
    { stage: "reading", status: "done" },
    { stage: "searching", done: 1, total: 10 },
  ]);
});

test("an error event is a real failure: AnalysisError, no fallback", async () => {
  const { impl, calls } = fakeFetch({
    "/api/analyze/stream": () => streamResponse(['{"stage":"reading","status":"done"}\n{"type":"error","error":"boom"}\n']),
    "/api/analyze": () => new Response(JSON.stringify(REPORT)),
  });
  let fellBack = false;
  await assert.rejects(
    runAnalysis({ apiBase: API, body: {}, onEvent: () => {}, onFallback: () => (fellBack = true), fetchImpl: impl }),
    (err) => err instanceof AnalysisError && err.message === "boom",
  );
  assert.equal(fellBack, false);
  assert.deepEqual(calls, ["/api/analyze/stream"]);
});

test("a 400 from the stream route shows its error and does not fall back", async () => {
  const { impl, calls } = fakeFetch({
    "/api/analyze/stream": () => new Response(JSON.stringify({ error: "bad data source" }), { status: 400 }),
  });
  await assert.rejects(
    runAnalysis({ apiBase: API, body: {}, onEvent: () => {}, onFallback: () => {}, fetchImpl: impl }),
    (err) => err instanceof AnalysisError && err.message === "bad data source",
  );
  assert.deepEqual(calls, ["/api/analyze/stream"]);
});

for (const [name, handler] of [
  ["the stream request fails at the network level", () => { throw new TypeError("Failed to fetch"); }],
  ["the backend has no stream route (404)", () => new Response("Not Found", { status: 404 })],
  ["the body can't be read as a stream", () => new Response(null, { status: 200 })],
  ["the stream ends before the report", () => streamResponse(['{"stage":"reading","status":"done"}\n'])],
] as const) {
  test(`falls back to /api/analyze when ${name}`, async () => {
    const { impl, calls } = fakeFetch({
      "/api/analyze/stream": handler as () => Response,
      "/api/analyze": () => new Response(JSON.stringify(REPORT)),
    });
    const reasons: string[] = [];
    const out = await runAnalysis({ apiBase: API, body: {}, onEvent: () => {}, onFallback: (r) => reasons.push(r), fetchImpl: impl });
    assert.deepEqual(out, { report: REPORT, mode: "timer" });
    assert.equal(reasons.length, 1);
    assert.deepEqual(calls, ["/api/analyze/stream", "/api/analyze"]);
  });
}

test("a successful stream never calls /api/analyze or the fallback", async () => {
  const { impl, calls } = fakeFetch({
    "/api/analyze/stream": () => streamResponse([`{"type":"result","report":${JSON.stringify(REPORT)}}\n`]),
  });
  let fellBack = false;
  const out = await runAnalysis({ apiBase: API, body: {}, onEvent: () => {}, onFallback: () => (fellBack = true), fetchImpl: impl });
  assert.deepEqual(out, { report: REPORT, mode: "live" });
  assert.equal(fellBack, false);
  assert.deepEqual(calls, ["/api/analyze/stream"]);
});

test("an aborted run neither falls back nor reports an analysis error", async () => {
  const impl = (async () => {
    throw new DOMException("aborted", "AbortError");
  }) as unknown as typeof fetch;
  let fellBack = false;
  await assert.rejects(
    runAnalysis({ apiBase: API, body: {}, onEvent: () => {}, onFallback: () => (fellBack = true), fetchImpl: impl }),
    (err) => (err as Error).name === "AbortError" && !(err instanceof StreamUnavailable),
  );
  assert.equal(fellBack, false);
});
