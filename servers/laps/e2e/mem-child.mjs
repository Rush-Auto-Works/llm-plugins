// Child process for parse-memory.test.mjs: parse one worst-case CSV shape and report. Not a test file.
// usage: node --max-old-space-size=N mem-child.mjs <bundle.mjs> <wide|narrow>
import { pathToFileURL } from 'node:url';

// Count every byte requested through `new Float64Array(n)` while parsing. Peak RSS only counts pages that were touched,
// so a buffer grown far past what the data needs is invisible there, but the Worker's memory limit counts it.
let allocatedBytes = 0;
globalThis.Float64Array = new Proxy(Float64Array, {
  construct(target, args) {
    const array = Reflect.construct(target, args);
    allocatedBytes += array.byteLength;
    return array;
  },
});

const [bundle, shape] = process.argv.slice(2);
const { parseCsv } = await import(pathToFileURL(bundle).href);

// wide: about 1.5M short numeric cells (the cell cap). narrow: 8 columns, long rows of ordinary AiM-looking numbers.
function build(kind) {
  const cols = kind === 'wide' ? 250 : 8;
  const names = Array.from({ length: cols }, (_, i) => `c${i}`);
  const units = names.map(() => 'u');
  const cell = kind === 'wide' ? '12' : '123.456';
  const row = Array.from({ length: cols }, () => cell).join(',');
  const rows = kind === 'wide' ? 5900 : 140000;
  const head = ['"Format","AiM CSV File"', '"Beacon Markers","60.0","120.0"', '', names.join(','), units.join(','), ''].join('\n') + '\n';
  return head + (row + '\n').repeat(rows);
}

const text = build(shape);
const before = process.resourceUsage().maxRSS;
const parsed = parseCsv(text);
const after = process.resourceUsage().maxRSS;
console.log(
  JSON.stringify({
    shape,
    bytes: text.length,
    columns: parsed.columns.length,
    rows: parsed.columns[0].length,
    first: parsed.columns[0][0],
    growthMB: Math.round((after - before) / 1024),
    allocatedMB: Math.round(allocatedBytes / 1048576),
  }),
);
