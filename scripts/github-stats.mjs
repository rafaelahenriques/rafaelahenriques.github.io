// GitHub numbers for the about page: most used languages and commit stats.
//
//   node scripts/github-stats.mjs        (runs on its own before `npm run build`)
//
// Writes src/data/github.json, from public data only: the public repos and
// their languages (REST API), the commits authored in public repos (commit
// search) and the contribution calendar on the public profile. GITHUB_TOKEN,
// if set, raises the API's rate limit. If GitHub can't be reached the last file
// stays as it is, so the build never fails over it.
import { mkdir, writeFile } from "node:fs/promises";

const USER = "rafaelahenriques"; // as in src/lib/site.ts
const OUT = new URL("../src/data/github.json", import.meta.url);
// the profile README repo has no code of its own
const SKIP_REPOS = new Set([USER]);
// build tooling rather than languages worth a row
const SKIP_LANGUAGES = new Set(["Dockerfile", "Makefile", "Shell", "CMake", "Mako", "Batchfile", "PowerShell", "Procfile"]);
const TOP = 8;

const api = async (path) => {
    const res = await fetch(`https://api.github.com/${path}`, {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": `${USER}-portfolio`,
            ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
        },
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
    return res.json();
};

/** Languages, each repo counted once: its share split by how much of it is in each language. */
async function languages(repos) {
    const shares = new Map();
    let counted = 0;
    for (const repo of repos) {
        const bytes = Object.entries(await api(`repos/${USER}/${repo.name}/languages`)).filter(([lang]) => !SKIP_LANGUAGES.has(lang));
        const total = bytes.reduce((sum, [, n]) => sum + n, 0);
        if (!total) continue;
        counted++;
        for (const [lang, n] of bytes) shares.set(lang, (shares.get(lang) ?? 0) + n / total);
    }
    const ranked = [...shares].sort((a, b) => b[1] - a[1]).map(([name, share]) => ({ name, percent: (share / counted) * 100 }));
    const top = ranked.slice(0, TOP);
    const other = ranked.slice(TOP).reduce((sum, l) => sum + l.percent, 0);
    return [...top, ...(other >= 0.5 ? [{ name: "Other", percent: other }] : [])].map((l) => ({ ...l, percent: Math.round(l.percent * 10) / 10 }));
}

/** The last year of contributions, day by day, from the profile's calendar. */
async function calendar() {
    const res = await fetch(`https://github.com/users/${USER}/contributions`, {
        headers: { "User-Agent": `${USER}-portfolio` },
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`${res.status} for the contribution calendar`);
    const html = await res.text();
    const tips = new Map([...html.matchAll(/for="(contribution-day-component-[\d-]+)"[^>]*>([^<]*)<\/tool-tip>/g)].map((m) => [m[1], m[2]]));
    const days = [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})" id="(contribution-day-component-[\d-]+)" data-level="(\d)"/g)]
        .map(([, date, id, level]) => ({ date, count: Number(/^(\d+) contributions? on/.exec(tips.get(id) ?? "")?.[1] ?? 0), level: Number(level) }))
        .sort((a, b) => a.date.localeCompare(b.date));
    if (days.length < 300) throw new Error(`the contribution calendar has ${days.length} days, expected a year`);
    return days;
}

const streaks = (days) => {
    let longest = 0;
    let run = 0;
    for (const d of days) {
        run = d.count ? run + 1 : 0;
        longest = Math.max(longest, run);
    }
    // today may not have anything yet; the streak still counts up to yesterday
    const fromEnd = [...days].reverse();
    if (!fromEnd[0].count) fromEnd.shift();
    const current = fromEnd.findIndex((d) => !d.count);
    return { longest, current: current < 0 ? fromEnd.length : current };
};

try {
    const repos = (await api(`users/${USER}/repos?per_page=100&type=owner`)).filter((r) => !r.fork && !r.private && !SKIP_REPOS.has(r.name));
    const commits = (await api(`search/commits?q=${encodeURIComponent(`author:${USER} is:public`)}&per_page=1`)).total_count;
    const days = await calendar();
    const busiest = days.reduce((a, b) => (b.count > a.count ? b : a));
    const data = {
        user: USER,
        updated: new Date().toISOString().slice(0, 10),
        repos: repos.length,
        commits,
        contributions: days.reduce((sum, d) => sum + d.count, 0),
        activeDays: days.filter((d) => d.count).length,
        streaks: streaks(days),
        busiest: { date: busiest.date, count: busiest.count },
        languages: await languages(repos),
        calendar: { start: days[0].date, levels: days.map((d) => d.level), counts: days.map((d) => d.count) },
    };
    await mkdir(new URL(".", OUT), { recursive: true });
    // (the day-by-day numbers on one line each)
    const json = JSON.stringify(data, null, 2).replace(/\[\s+([\d,\s]+?)\s+\]/g, (_, nums) => `[${nums.replace(/\s+/g, "")}]`);
    await writeFile(OUT, json + "\n");
    console.log(`github-stats: ${data.commits} commits, ${data.contributions} contributions, ${data.languages.map((l) => `${l.name} ${l.percent}%`).join(", ")}`);
} catch (err) {
    console.warn(`github-stats: kept the last numbers (${err.message})`);
}
