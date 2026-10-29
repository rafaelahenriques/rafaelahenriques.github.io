import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

const MOTION = "(prefers-reduced-motion: no-preference)";

/** Fade in the header items on load. */
function introHeader() {
    gsap.from("[data-header] > *", {
        autoAlpha: 0,
        y: -12,
        duration: 1,
        ease: "expo.out",
        stagger: 0.06,
    });
}

/**
 * [data-split]: masked line-by-line reveal. Add data-split-delay="0.4" to
 * stagger elements that are visible on load.
 */
function splitReveals() {
    document.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
        SplitText.create(el, {
            type: "lines",
            mask: "lines",
            linesClass: "split-line",
            autoSplit: true,
            onSplit(self) {
                gsap.set(el, { visibility: "visible" });
                return gsap.from(self.lines, {
                    yPercent: 110,
                    duration: 0.8,
                    ease: "expo.out",
                    stagger: 0.06,
                    delay: Number(el.dataset.splitDelay ?? 0),
                    scrollTrigger: { trigger: el, start: "top 90%", once: true },
                });
            },
        });
    });
}

/** [data-rise]: big words whose [data-rise-line] lines rise out of their own masks. */
function riseReveals() {
    document.querySelectorAll<HTMLElement>("[data-rise]").forEach((el) => {
        el.classList.add("is-risen");
        gsap.from(el.querySelectorAll("[data-rise-line]"), {
            yPercent: 110,
            duration: 0.8,
            ease: "expo.out",
            stagger: 0.06,
            scrollTrigger: { trigger: el, start: "top 95%", once: true },
        });
    });
}

/** [data-reveal]: fade up in batches as they scroll into view. */
function fadeReveals() {
    // (some pages have none)
    if (!document.querySelector("[data-reveal]")) return;
    gsap.set("[data-reveal]", { autoAlpha: 0, y: 24 });
    ScrollTrigger.batch("[data-reveal]", {
        start: "top 92%",
        once: true,
        onEnter: (els) =>
            gsap.to(els, {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                ease: "expo.out",
                stagger: 0.05,
            }),
    });
}

/**
 * [data-reveal-img]: the picture breaks in out of pixels, squares in the page
 * colour clearing in a ragged sweep from the top, in steps.
 */
function imageReveals() {
    document.querySelectorAll<HTMLElement>("[data-reveal-img]").forEach((el) => {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        if (!w || !h) return;
        // squares of roughly the same size whatever the picture
        const cols = Math.max(6, Math.round(w / 56));
        const rows = Math.max(4, Math.round((h / w) * cols));
        const grid = document.createElement("span");
        grid.className = "px-cells";
        grid.setAttribute("aria-hidden", "true");
        grid.style.gridTemplate = `repeat(${rows}, 1fr) / repeat(${cols}, 1fr)`;
        const cells: HTMLElement[] = [];
        const order: number[] = [];
        for (let i = 0; i < cols * rows; i++) {
            cells.push(grid.appendChild(document.createElement("i")));
            order.push((Math.floor(i / cols) / rows) * 0.6 + Math.random() * 0.4);
        }
        if (getComputedStyle(el).position === "static") el.style.position = "relative";
        el.appendChild(grid);

        const sweep = { p: 0 };
        gsap.to(sweep, {
            p: 1,
            duration: 0.6,
            ease: "steps(10)",
            onUpdate: () => cells.forEach((c, i) => (c.style.visibility = order[i] < sweep.p ? "hidden" : "visible")),
            onComplete: () => grid.remove(),
            scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
        });
    });
}

/** [data-decode]: small mono text types itself in out of noise. */
function decodeReveals() {
    const glyphs = "█▓▒░/\\_-=+*#01";
    document.querySelectorAll<HTMLElement>("[data-decode]").forEach((el) => {
        const texts: [Text, string][] = [];
        const walk = (n: Node) => (n.nodeType === Node.TEXT_NODE ? texts.push([n as Text, n.textContent ?? ""]) : n.childNodes.forEach(walk));
        walk(el);
        const progress = { k: 0 };
        gsap.to(progress, {
            k: 1,
            duration: 0.7,
            ease: "none",
            onUpdate: () => {
                for (const [node, text] of texts) {
                    const upto = Math.floor(text.length * progress.k);
                    node.textContent =
                        text.slice(0, upto) +
                        [...text.slice(upto)].map((ch) => (/\s/.test(ch) ? ch : glyphs[(Math.random() * glyphs.length) | 0])).join("");
                }
            },
            onComplete: () => texts.forEach(([node, text]) => (node.textContent = text)),
            scrollTrigger: { trigger: el, start: "top 92%", once: true },
        });
    });
}

/** .prose pre: a code block's lines appear one after another, top to bottom. */
function codeReveals() {
    document.querySelectorAll<HTMLElement>(".prose pre").forEach((pre) => {
        gsap.from(pre.querySelectorAll(".line"), {
            autoAlpha: 0,
            duration: 0.5,
            ease: "power2.out",
            stagger: 0.05,
            scrollTrigger: { trigger: pre, start: "top 85%", once: true },
        });
    });
}

export function initAnimations() {
    // While the loading screen or the page change is up, wait for it so the
    // intro plays on a visible page
    let started = false;
    const go = () => {
        if (started) return;
        started = true;
        start();
    };
    const root = document.documentElement;
    if (root.classList.contains("is-loading")) {
        window.addEventListener("loader:done", go, { once: true });
        setTimeout(go, 5500); // in case the loader never reports back
    } else if (root.classList.contains("is-wiping")) {
        window.addEventListener("wipe:done", go, { once: true });
        setTimeout(go, 3000);
    } else {
        go();
    }
}

function start() {
    const mm = gsap.matchMedia();

    mm.add(MOTION, (ctx) => {
        introHeader();
        riseReveals();
        fadeReveals();
        imageReveals();
        decodeReveals();
        codeReveals();
        // Split after webfonts load so line breaks are measured correctly;
        // ctx.add keeps it inside this matchMedia context for cleanup.
        document.fonts.ready.then(() => ctx.add(splitReveals));
    });

    // the page may have reflowed under the loader; re-measure every trigger
    ScrollTrigger.refresh();
}
