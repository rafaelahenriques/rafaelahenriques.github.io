// Typographic covers for projects that don't have screenshots yet.
//
//   node scripts/build-covers.mjs
//
// Writes src/content/projects/<slug>/cover.png (1200×1500, the 4:5 grid ratio).
// Replace a cover with a real screenshot once the project has one.
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const W = 1200;
const H = 1500;
const PAD = 96;
const PAPER = "#f3f1ec";
const INK = "#111110";
const MUTED = "#75736e";
const LINE = "#d9d6cf";
const SANS = "Helvetica Neue, Helvetica, Arial, sans-serif";
const MONO = "Menlo, Courier New, monospace";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const covers = [
    {
        slug: "mongmo",
        kicker: "02 — Mobile",
        title: ["Mongmo"],
        stack: "React Native · TypeScript · Expo · Supabase",
        // a phone outline, the only motif
        art: `<rect x="${W / 2 - 170}" y="300" width="340" height="640" rx="56" fill="none" stroke="${INK}" stroke-width="4"/>
              <line x1="${W / 2 - 50}" x2="${W / 2 + 50}" y1="335" y2="335" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    },
    {
        slug: "trading-backtester",
        kicker: "03 — Backend & Data · In progress",
        title: ["Trading", "Backtesting", "Engine"],
        stack: "Python · PostgreSQL · APIs · Docker · Testing",
        art: ["Historical data", "Data processing", "Strategy engine", "Order simulation", "Portfolio engine", "Performance analysis"]
            .map((stage, i) => {
                const y = 250 + i * 92;
                const arrow = i < 5 ? `<text x="${PAD}" y="${y + 52}" font-family="${MONO}" font-size="24" fill="${MUTED}">↓</text>` : "";
                return `<text x="${PAD}" y="${y}" font-family="${MONO}" font-size="30" fill="${INK}">${esc(stage)}</text>${arrow}`;
            })
            .join(""),
    },
    {
        slug: "ml5-pose-classifier",
        kicker: "Experiment — Machine learning",
        title: ["ML5.js", "Pose Classifier"],
        stack: "ml5.js · JavaScript · Canvas",
        // a stick figure in guard: the keypoints the model reads
        art: (() => {
            const pts = { head: [600, 330], neck: [600, 420], lsh: [520, 440], rsh: [680, 440], lel: [470, 540], rel: [730, 540], lwr: [540, 470], rwr: [660, 470], hip: [600, 640], lkn: [530, 790], rkn: [670, 790], lft: [500, 930], rft: [700, 930] };
            const bones = [["neck", "lsh"], ["neck", "rsh"], ["lsh", "lel"], ["lel", "lwr"], ["rsh", "rel"], ["rel", "rwr"], ["neck", "hip"], ["hip", "lkn"], ["lkn", "lft"], ["hip", "rkn"], ["rkn", "rft"]];
            const lines = bones.map(([a, b]) => `<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`).join("");
            const dots = Object.entries(pts).map(([k, [x, y]]) => `<circle cx="${x}" cy="${y}" r="${k === "head" ? 34 : 10}" fill="${k === "head" ? "none" : PAPER}" stroke="${INK}" stroke-width="4"/>`).join("");
            return lines + dots;
        })(),
    },
];

for (const c of covers) {
    const titleSize = c.title.length > 2 ? 104 : 120;
    const titleTop = H - PAD - 90 - (c.title.length - 1) * titleSize * 0.95;
    const title = c.title
        .map((line, i) => `<text x="${PAD}" y="${titleTop + i * titleSize * 0.95}" font-family="${SANS}" font-weight="500" font-size="${titleSize}" letter-spacing="-5" fill="${INK}">${esc(line)}</text>`)
        .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <rect width="100%" height="100%" fill="${PAPER}"/>
        <text x="${PAD}" y="${PAD + 20}" font-family="${MONO}" font-size="26" fill="${MUTED}" letter-spacing="1">${esc(c.kicker.toUpperCase())}</text>
        <line x1="${PAD}" x2="${W - PAD}" y1="${PAD + 50}" y2="${PAD + 50}" stroke="${LINE}" stroke-width="2"/>
        ${c.art}
        ${title}
        <text x="${PAD}" y="${H - PAD}" font-family="${MONO}" font-size="26" fill="${MUTED}">${esc(c.stack)}</text>
    </svg>`;
    const out = `src/content/projects/${c.slug}/cover.png`;
    await mkdir(`src/content/projects/${c.slug}`, { recursive: true });
    await sharp(Buffer.from(svg)).png().toFile(out);
    console.log(`Wrote ${out}`);
}
