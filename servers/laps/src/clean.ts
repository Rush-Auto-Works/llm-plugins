// For names copied out of the uploaded file into the result (session fields, channel names, units): letters,
// digits, space and a few name characters only. URL punctuation never survives, so a string from the file cannot
// carry a link, an address or a query, and "://" is dropped before the allowlist runs.
const NOT_NAME_CHAR = /[^\p{L}\p{N} _.'&-]/gu;
// A period that runs into a letter is how a bare domain reads (evil.example, evil1.example), and some clients link
// those, so a period followed by a letter, or between a letter and a digit, goes. Periods between digits (v1.2,
// 24.5) and before a space (St. Louis) stay.
const BARE_DOMAIN_DOT = /\.(?=\p{L})|(?<=\p{L})\.(?=\p{N})/gu;

export function label(text: string, max = 80): string {
  const plain = clean(text, 4096).replace(/:\/\//g, " ").replace(NOT_NAME_CHAR, " ").replace(BARE_DOMAIN_DOT, " ").replace(/\s+/g, " ").trim();
  return [...plain].slice(0, max).join("");
}

export function clean(text: string, max = 80): string {
  const normalized = text.normalize("NFKC")
    .replace(/[\p{C}\p{Zl}\p{Zp}\p{M}]/gu, "")
    // Underscore stays: AiM channel names use it (GPS_Speed, Front_Brake_p) and it does not start markdown mid-word.
    .replace(/[`*#()\[\]<>!|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...normalized].slice(0, max).join("");
}
