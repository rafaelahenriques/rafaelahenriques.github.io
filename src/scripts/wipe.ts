/**
 * The page change: the screen fills with big square pixels in a ragged sweep
 * from the left (the leading edge blue, like a cursor running ahead), and on
 * the next page they clear the same way. The loader leaves like this too.
 * Draws into the canvas in PageWipe.astro, one canvas pixel per square.
 */

const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;

let canvas: HTMLCanvasElement | null = null;
let g: CanvasRenderingContext2D | null = null;
let cells: { x: number; y: number; o: number }[] = [];

const layout = () => {
    if (!canvas) return;
    const size = window.innerWidth < 700 ? 36 : 56;
    canvas.width = Math.ceil(window.innerWidth / size);
    canvas.height = Math.ceil(window.innerHeight / size);
    cells = [];
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            // left to right, with a ragged edge
            cells.push({ x, y, o: (x / canvas.width) * 0.76 + Math.random() * 0.24 });
        }
    }
};

const setUp = () => {
    if (canvas) return !!g;
    canvas = document.querySelector<HTMLCanvasElement>("[data-wipe]");
    g = canvas?.getContext("2d") ?? null;
    layout();
    window.addEventListener("resize", layout);
    return !!g;
};

/** p: how far the sweep has got, 0–1 */
const paint = (p: number, covering: boolean) => {
    if (!canvas || !g) return;
    const css = getComputedStyle(root);
    const fill = css.getPropertyValue("--text").trim() || "#0e0e0e";
    const blue = css.getPropertyValue("--blue").trim() || "#2f3dff";
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (const c of cells) {
        const on = covering ? c.o < p : c.o >= p;
        if (!on) continue;
        g.fillStyle = covering && c.o > p - 0.06 ? blue : fill;
        g.fillRect(c.x, c.y, 1, 1);
    }
};

const sweep = (covering: boolean, duration: number) =>
    new Promise<void>((done) => {
        const start = performance.now();
        const frame = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            // in steps, like a screen redrawing
            paint((Math.round(t * 14) / 14) * 1.07, covering);
            if (t < 1) requestAnimationFrame(frame);
            else done();
        };
        requestAnimationFrame(frame);
    });

/** fill the screen with pixels */
export async function cover(duration = 420) {
    if (still || !setUp()) return;
    canvas!.hidden = false;
    await sweep(true, duration);
}

/** start fully covered, then clear the pixels away */
export async function uncover(duration = 620) {
    if (!setUp()) {
        root.classList.remove("is-wiping");
        return;
    }
    canvas!.hidden = false;
    paint(0, false);
    root.classList.remove("is-wiping");
    if (!still) await sweep(false, duration);
    clear();
}

/** take the pixels away at once (e.g. coming back to a page from the history) */
export function clear() {
    if (!canvas || !g) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    canvas.hidden = true;
}

/** cover, then go to another page of the site, which uncovers itself */
export async function go(href: string) {
    await cover();
    try {
        if (!still) sessionStorage.setItem("wipe", "1");
    } catch {}
    window.location.href = href;
}
