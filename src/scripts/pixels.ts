/**
 * Pixel edges: a band of big square pixels where the page dissolves into the
 * block next to it (the footer, the next project, the arcade). The shape comes
 * from seeded noise, so it's the same on every visit: solid at the side that
 * meets the block, breaking up into clusters and stray pixels towards the
 * page, with small tick marks where the two meet. The pixel under the cursor
 * lights up, and pixels flip as the cursor passes and settle back.
 */

/** a repeatable 0–1 value for a cell */
const hash = (x: number, y: number, seed: number) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/** smooth value noise, a few octaves */
const noise = (x: number, y: number, seed: number) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < 3; o++) {
        const xf = x * f;
        const yf = y * f;
        const x0 = Math.floor(xf);
        const y0 = Math.floor(yf);
        const tx = xf - x0;
        const ty = yf - y0;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const a = hash(x0, y0, seed + o);
        const b = hash(x0 + 1, y0, seed + o);
        const c = hash(x0, y0 + 1, seed + o);
        const d = hash(x0 + 1, y0 + 1, seed + o);
        sum += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
        amp *= 0.5;
        f *= 2;
    }
    return sum / 0.875;
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FLIP_MS = 900;

function mount(el: HTMLElement) {
    const canvas = el.querySelector("canvas")!;
    const g = canvas.getContext("2d")!;
    const seed = Number(el.dataset.seed ?? 1);
    const rows = Number(el.dataset.rows ?? 7);
    // "down": empty at the top, solid at the bottom (a block below); "up": the other way
    const down = el.dataset.direction !== "up";
    const tone = el.dataset.tone === "night" ? "--night-bg" : "--bg-inverse";

    let cols = 0;
    let cell = 0;
    let base = new Uint8Array(0);
    let flippedAt = new Float64Array(0);
    let hover = -1;
    let colors = { fill: "#111", tick: "#888", accent: "#36f" };
    let raf = 0;

    const readColors = () => {
        const css = getComputedStyle(el);
        colors = {
            fill: css.getPropertyValue(tone).trim() || "#111",
            tick: css.getPropertyValue("--muted").trim() || "#888",
            accent: css.getPropertyValue("--pixel-accent").trim() || "#36f",
        };
    };

    const build = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (!w || !h) return;
        cell = h / rows;
        cols = Math.ceil(w / cell);
        const dpr = Math.min(window.devicePixelRatio, 2);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        base = new Uint8Array(cols * rows);
        flippedAt = new Float64Array(cols * rows).fill(-Infinity);
        for (let r = 0; r < rows; r++) {
            // 0 at the page side, 1 where it meets the block
            const t = down ? (r + 0.5) / rows : 1 - (r + 0.5) / rows;
            for (let c = 0; c < cols; c++) {
                // clusters from the noise, broken up cell by cell
                const v = t + (noise(c * 0.32, r * 0.5, seed) - 0.5) * 0.9 + (hash(c, r, seed + 5) - 0.5) * 0.3;
                let on = v > 0.55;
                // and a few stray pixels further out on the page
                if (!on && hash(c, r, seed + 7) < 0.04) on = true;
                // the row that touches the block is solid, so the two join up
                if ((down && r === rows - 1) || (!down && r === 0)) on = true;
                base[r * cols + c] = on ? 1 : 0;
            }
        }
        draw(performance.now());
    };

    const isOn = (i: number, now: number) => (base[i] === 1) !== now - flippedAt[i] < FLIP_MS;

    const draw = (now: number) => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        g.clearRect(0, 0, w, h);
        g.fillStyle = colors.fill;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!isOn(r * cols + c, now)) continue;
                // a hair of overlap so neighbouring pixels never show a seam
                g.fillRect(Math.floor(c * cell), Math.floor(r * cell), Math.ceil(cell) + 1, Math.ceil(cell) + 1);
            }
        }
        // tick marks: two small dots in an empty cell, on the side that touches a pixel
        g.fillStyle = colors.tick;
        const d = Math.max(1.5, cell * 0.06);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c;
                if (isOn(i, now)) continue;
                const x = c * cell;
                const y = r * cell;
                if (c > 0 && isOn(i - 1, now)) {
                    g.fillRect(x + cell * 0.18, y + cell * 0.32, d, d);
                    g.fillRect(x + cell * 0.18, y + cell * 0.62, d, d);
                }
                if (r < rows - 1 && isOn(i + cols, now)) {
                    g.fillRect(x + cell * 0.32, y + cell * 0.78, d, d);
                    g.fillRect(x + cell * 0.62, y + cell * 0.78, d, d);
                }
            }
        }
        if (hover >= 0) {
            const x = (hover % cols) * cell;
            const y = Math.floor(hover / cols) * cell;
            g.save();
            g.shadowColor = colors.accent;
            g.shadowBlur = cell * 0.8;
            g.fillStyle = colors.accent;
            g.globalAlpha = 0.9;
            g.fillRect(x, y, cell, cell);
            g.restore();
        }
    };

    // animate only while flipped pixels are settling back
    const tick = () => {
        const now = performance.now();
        draw(now);
        let busy = false;
        for (let i = 0; i < flippedAt.length && !busy; i++) busy = now - flippedAt[i] < FLIP_MS;
        raf = busy ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
        if (!raf) raf = requestAnimationFrame(tick);
    };

    el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const c = Math.floor((e.clientX - r.left) / cell);
        const row = Math.floor((e.clientY - r.top) / cell);
        if (c < 0 || c >= cols || row < 0 || row >= rows) return;
        const i = row * cols + c;
        if (i === hover) return;
        // the pixel the cursor just left flips, then settles back
        if (hover >= 0 && !reduceMotion) flippedAt[hover] = performance.now();
        hover = i;
        kick();
        if (reduceMotion) draw(performance.now());
    });
    el.addEventListener("pointerleave", () => {
        hover = -1;
        kick();
        if (reduceMotion) draw(performance.now());
    });

    readColors();
    build();
    new ResizeObserver(build).observe(el);
    // the theme changes the colours
    new MutationObserver(() => {
        readColors();
        draw(performance.now());
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

export function mountPixelEdges() {
    document.querySelectorAll<HTMLElement>("[data-pixel-edge]").forEach((el) => {
        if (el.dataset.mounted) return;
        el.dataset.mounted = "";
        mount(el);
    });
}
