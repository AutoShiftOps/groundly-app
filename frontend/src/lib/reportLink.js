// GitHub issue #17 (Share). Reports aren't persisted anywhere -- no
// backend storage, no stable report ID, and a report doesn't even
// survive a same-tab refresh today (App.tsx holds it in plain React
// state). Confirmed decision: "Share" means a copy-current-session
// link with no new infra, not a real persisted public URL -- so this
// makes the URL itself the storage: the full report is gzip-compressed
// (native CompressionStream, no new dependency) and base64url-encoded
// directly into the hash fragment, which never leaves the browser. The
// resulting link, opened by anyone (same browser or not), decodes and
// restores the exact same report client-side -- genuinely reproducing
// what "share" promises, without a backend.
//
// Falls back to an uncompressed encoding when CompressionStream isn't
// available (older browsers) -- still fully functional, just a longer
// URL. If even that's unavailable or the payload is unreasonably large,
// encodeReportLink returns null and the caller shows an honest error
// instead of a silently broken link.

const MAX_URL_LENGTH = 60000; // well under practical browser/address-bar limits, with headroom

function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function gzipCompress(bytes) {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gzipDecompress(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Builds a full shareable URL for the given { idea, report } payload,
// or null if it couldn't be encoded within MAX_URL_LENGTH.
export async function encodeReportLink(payload) {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  const compressed = await gzipCompress(jsonBytes);
  const mode = compressed ? "gz" : "raw";
  const encoded = bytesToBase64Url(compressed || jsonBytes);
  const hash = `#shared=${mode}.${encoded}`;
  if (hash.length > MAX_URL_LENGTH) return null;
  return `${window.location.origin}${window.location.pathname}${hash}`;
}

// Reads window.location.hash (if it's a #shared=... link) and decodes
// it back into { idea, report }, or null if there's nothing to decode
// or decoding fails for any reason (corrupted/truncated link, browser
// missing DecompressionStream for a gz-mode link, etc).
export async function decodeReportLinkFromHash() {
  const match = window.location.hash.match(/^#shared=(gz|raw)\.(.+)$/);
  if (!match) return null;
  const [, mode, encoded] = match;
  try {
    const bytes = base64UrlToBytes(encoded);
    const jsonBytes = mode === "gz" ? await gzipDecompress(bytes) : bytes;
    return JSON.parse(new TextDecoder().decode(jsonBytes));
  } catch (err) {
    console.error("decodeReportLinkFromHash: failed to decode shared link", err);
    return null;
  }
}

// Clears a #shared=... hash from the URL without reloading the page --
// called on "Start New Analysis" so a stale shared link doesn't keep
// restoring itself.
export function clearSharedHash() {
  if (window.location.hash.startsWith("#shared=")) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}
