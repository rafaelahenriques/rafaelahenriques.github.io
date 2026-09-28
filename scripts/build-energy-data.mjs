// Builds the data behind the "How Belgium makes its electricity" story.
//
//   node scripts/build-energy-data.mjs [path/to/owid-energy-data.csv]
//
// Without a path it downloads the CSV from Our World in Data. Writes:
//   src/data/belgium-electricity.json             – the numbers the page renders
//   src/content/projects/belgium-electricity/cover.png – cover for grid/carousel
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";

const SOURCE_URL = "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv";
const OUT_JSON = "src/data/belgium-electricity.json";
const OUT_COVER = "src/content/projects/belgium-electricity/cover.png";
const FIRST_YEAR = 1990;
const NEIGHBOURS = ["Belgium", "France", "Germany", "Netherlands"];

// Minimal RFC 4180 parser: handles quoted fields ("Korea, North").
function parseCsv(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
        else if (c !== "\r") field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const [header, ...body] = rows;
    return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const num = (v) => (v === undefined || v === "" ? null : Number(v));
const round = (v) => (v === null ? null : Math.round(v * 10) / 10);
const sum = (...vs) => (vs.every((v) => v === null) ? null : vs.reduce((a, v) => a + (v ?? 0), 0));

const csvPath = process.argv[2];
const text = csvPath
    ? await readFile(csvPath, "utf8")
    : await fetch(SOURCE_URL).then((r) => {
          if (!r.ok) throw new Error(`Download failed: ${r.status}`);
          return r.text();
      });
const rows = parseCsv(text).filter((r) => Number(r.year) >= FIRST_YEAR);

const byCountry = (name) =>
    rows.filter((r) => r.country === name).sort((a, b) => a.year - b.year);

// Belgium's electricity mix, % of generation. Oil, bioenergy, hydro and other
// renewables fold into "other" so the chart keeps five named sources.
const belgium = byCountry("Belgium")
    .filter((r) => num(r.nuclear_share_elec) !== null && num(r.coal_share_elec) !== null)
    .map((r) => ({
        year: Number(r.year),
        nuclear: round(num(r.nuclear_share_elec)),
        gas: round(num(r.gas_share_elec)),
        wind: round(num(r.wind_share_elec)),
        solar: round(num(r.solar_share_elec)),
        coal: round(num(r.coal_share_elec)),
        other: round(
            sum(
                num(r.oil_share_elec),
                num(r.biofuel_share_elec),
                num(r.hydro_share_elec),
                num(r.other_renewables_share_elec_exc_biofuel),
            ),
        ),
        generationTWh: round(num(r.electricity_generation)),
    }));

const years = belgium.map((d) => d.year);

// Low-carbon share (nuclear + renewables) for Belgium and its neighbours.
const lowCarbon = Object.fromEntries(
    NEIGHBOURS.map((name) => {
        const series = new Map(byCountry(name).map((r) => [Number(r.year), num(r.low_carbon_share_elec)]));
        return [name, years.map((y) => round(series.get(y) ?? null))];
    }),
);

const data = {
    source: "Our World in Data – Energy dataset (Ember, Energy Institute)",
    sourceUrl: "https://github.com/owid/energy-data",
    license: "CC BY 4.0",
    retrieved: new Date().toISOString().slice(0, 10),
    unit: "% of electricity generation",
    years,
    belgium,
    lowCarbon,
};

await mkdir(dirname(OUT_JSON), { recursive: true });
await writeFile(OUT_JSON, JSON.stringify(data, null, 2) + "\n");
console.log(`Wrote ${OUT_JSON}: ${years[0]}–${years.at(-1)}, ${belgium.length} years`);

// Cover: the five source lines on paper, no text, 4:5 like the grid cards.
const W = 1200, H = 1500, PAD = 120;
const colors = { nuclear: "#2a78d6", gas: "#eb6834", wind: "#1baf7a", solar: "#eda100", coal: "#e87ba4" };
const x = (i) => PAD + (i / (years.length - 1)) * (W - PAD * 2);
const y = (v) => H - PAD - (v / 70) * (H - PAD * 2);
const paths = Object.entries(colors)
    .map(([key, color]) => {
        const d = belgium.map((row, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(row[key]).toFixed(1)}`).join("");
        return `<path d="${d}" fill="none" stroke="${color}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>`;
    })
    .join("");
const grid = [0, 20, 40, 60]
    .map((v) => `<line x1="${PAD}" x2="${W - PAD}" y1="${y(v)}" y2="${y(v)}" stroke="#d9d6cf" stroke-width="2"/>`)
    .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#f3f1ec"/>${grid}${paths}</svg>`;

await mkdir(dirname(OUT_COVER), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(OUT_COVER);
console.log(`Wrote ${OUT_COVER}`);
