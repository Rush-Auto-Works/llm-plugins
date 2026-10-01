export const MANUAL_PUBLIC_DEFAULT = "https://manual.rush.sr";
export const CONTACT_URL = "https://rushautoworks.com/contact/";
const RUSH_CARD_URL = "https://rushautoworks.com/rush-sr/";

function publicBase(configured?: string): string {
  return (configured || MANUAL_PUBLIC_DEFAULT).replace(/\/+$/, "");
}

// Index text becomes part of a markdown link target, so encode by allowlist: anything outside this set is
// percent-encoded, including whitespace, brackets, quotes, parentheses, "?", "#" and "%". Real routes use letters,
// digits, "-", "/" and "+" (long-term-maintenance-150hr+), which stay as they are.
const SAFE_URL_CHAR = /[A-Za-z0-9\-._~/+:@]/;

// encodeURIComponent leaves ! ' ( ) * alone, and a ")" would end the link, so encode those by hand too.
function encodeChar(ch: string): string {
  return encodeURIComponent(ch).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

// toWellFormed first: a lone surrogate (malformed UTF-16 that JSON can still carry) makes encodeURIComponent throw
// URIError, which would fail the whole tool call over one bad index entry.
function encodeUrlPart(value: string): string {
  return [...value.toWellFormed()].map((ch) => (SAFE_URL_CHAR.test(ch) ? ch : encodeChar(ch))).join("");
}

export function manualUrl(route: string, anchor: string, configured?: string): string {
  const base = publicBase(configured);
  const path = route ? `/${encodeUrlPart(route.replace(/^\/+|\/+$/g, ""))}` : "";
  const hash = anchor ? `#${encodeUrlPart(anchor).replaceAll("/", "%2F")}` : "";
  return `${base}${path}${hash}`;
}

function withUtm(url: string, toolName: string): string {
  const params = new URLSearchParams({
    utm_source: "mcp",
    utm_medium: "plugin",
    utm_campaign: "rush-sr-maintenance",
    utm_content: toolName,
  });
  return `${url}?${params.toString()}`;
}

export function rushCardUrl(toolName: string): string {
  return withUtm(RUSH_CARD_URL, toolName);
}

export function contactUrl(toolName: string): string {
  return withUtm(CONTACT_URL, toolName);
}
