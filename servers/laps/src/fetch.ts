import type { Env } from "./index";

const downloadFailure = "Could not download the file. Upload it again or paste the CSV text.";
const forbidden = "This download URL is not allowed. Upload an AiM RaceStudio CSV export or paste its text.";
const binaryFailure = "This looks like a binary .xrk file. Export CSV from AiM RaceStudio and upload that CSV.";

function allowedUrl(raw: string, env: Env): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(forbidden);
  }
  const insecure = env.ALLOW_INSECURE_FETCH === "1";
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const local = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal");
  const literal = host.startsWith("[") || /^[\d.]+$/.test(host);
  const loopback = host === "localhost" || host === "127.0.0.1";
  if (url.protocol !== "https:" && !(insecure && loopback && url.protocol === "http:")) throw new Error(forbidden);
  if ((local || literal) && !(insecure && loopback)) throw new Error(forbidden);
  if (url.port && url.port !== "443" && !(insecure && loopback)) throw new Error(forbidden);
  if (url.username || url.password) throw new Error(forbidden);
  return url;
}

export async function downloadCsv(raw: string, env: Env, limit: number): Promise<string> {
  const url = allowedUrl(raw, env);
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
    void reader?.cancel().catch(() => undefined);
  }, 5_000);
  try {
    const response = await fetch(url.toString(), { redirect: "manual", signal: controller.signal });
    if (!response.ok || (response.status >= 300 && response.status < 400)) throw new Error(downloadFailure);
    const declared = Number(response.headers.get("content-length"));
    if (declared > limit) throw new Error(`CSV exceeds the ${limit} byte limit. Export a smaller session from RaceStudio.`);
    if (!response.body) throw new Error(downloadFailure);
    reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error(`CSV exceeds the ${limit} byte limit. Export a smaller session from RaceStudio.`);
      }
      if (value.byteLength) parts.push(value);
    }
    if (timedOut) throw new Error(downloadFailure);
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
    } catch {
      throw new Error(binaryFailure);
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("byte limit") || error.message === binaryFailure)) throw error;
    throw new Error(downloadFailure);
  } finally {
    clearTimeout(timer);
  }
}
