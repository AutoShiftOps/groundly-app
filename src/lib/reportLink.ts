import type { GroundlyReport } from "../types/groundly";

const MAX_URL_LENGTH = 60000;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function gzipCompress(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream = new Blob([copy])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gzipDecompress(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream = new Blob([copy])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export interface SharedPayload {
  idea: string;
  report: GroundlyReport;
}

export async function encodeReportLink(
  payload: SharedPayload,
): Promise<string | null> {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  const compressed = await gzipCompress(jsonBytes);
  const mode = compressed ? "gz" : "raw";
  const encoded = bytesToBase64Url(compressed || jsonBytes);
  const hash = `#shared=${mode}.${encoded}`;
  if (hash.length > MAX_URL_LENGTH) return null;
  return `${window.location.origin}${window.location.pathname}${hash}`;
}

export async function decodeReportLinkFromHash(): Promise<SharedPayload | null> {
  const match = window.location.hash.match(/^#shared=(gz|raw)\.(.+)$/);
  if (!match) return null;
  const [, mode, encoded] = match;
  try {
    const bytes = base64UrlToBytes(encoded);
    const jsonBytes = mode === "gz" ? await gzipDecompress(bytes) : bytes;
    return JSON.parse(new TextDecoder().decode(jsonBytes)) as SharedPayload;
  } catch {
    return null;
  }
}

export function clearSharedHash(): void {
  if (window.location.hash.startsWith("#shared=")) {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
}
