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
                    duration: 1.2,
                    ease: "expo.out",
                    stagger: 0.08,
                    delay: Number(el.dataset.splitDelay ?? 0),
                    scrollTrigger: { trigger: el, start: "top 90%", once: true },
                });
            },
        });
    });
}

/** [data-reveal]: fade up in batches as they scroll into view. */
function fadeReveals() {
    // (some pages have none)
    if (!document.querySelector("[data-reveal]")) return;
    gsap.set("[data-reveal]", { autoAlpha: 0, y: 32 });
    ScrollTrigger.batch("[data-reveal]", {
        start: "top 92%",
        once: true,
        onEnter: (els) =>
            gsap.to(els, {
                autoAlpha: 1,
                y: 0,
                duration: 1.1,
                ease: "expo.out",
                stagger: 0.08,
            }),
    });
}

/** [data-reveal-img]: wipe the frame open and settle the image inside it. */
function imageReveals() {
    document.querySelectorAll<HTMLElement>("[data-reveal-img]").forEach((el) => {
        const img = el.querySelector("img");
        // plays once without killing its trigger: a timeline trigger that kills
        // itself during another trigger's first refresh (page loaded mid-scroll)
        // breaks ScrollTrigger's refresh loop
        const tl = gsap.timeline({
            scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
        });
        tl.fromTo(
            el,
            { clipPath: "inset(100% 0% 0% 0%)" },
            {
                clipPath: "inset(0% 0% 0% 0%)",
                duration: 1.3,
                ease: "expo.inOut",
                clearProps: "clipPath",
            },
        );
        if (img) {
            // clearProps hands the transform back to CSS hover styles afterwards
            tl.from(
                img,
                { scale: 1.25, duration: 1.6, ease: "expo.out", clearProps: "transform" },
                0.2,
            );
        }
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
    // While the loading screen is up, wait for it so the intro plays on a visible page
    let started = false;
    const go = () => {
        if (started) return;
        started = true;
        start();
    };
    if (document.documentElement.classList.contains("is-loading")) {
        window.addEventListener("loader:done", go, { once: true });
        setTimeout(go, 5500); // in case the loader never reports back
    } else {
        go();
    }
}

function start() {
    const mm = gsap.matchMedia();

    mm.add(MOTION, (ctx) => {
        introHeader();
        fadeReveals();
        imageReveals();
        codeReveals();
        // Split after webfonts load so line breaks are measured correctly;
        // ctx.add keeps it inside this matchMedia context for cleanup.
        document.fonts.ready.then(() => ctx.add(splitReveals));
    });

    // the page may have reflowed under the loader; re-measure every trigger
    ScrollTrigger.refresh();
}
