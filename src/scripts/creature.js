import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";

gsap.registerPlugin(Draggable);

/*
 * The footer pet, in pixels: one canvas pixel per square, drawn in the
 * footer's text colour. It breathes and blinks, its eyes follow the cursor,
 * it squeezes its eyes shut (><) while dragged, and in dark mode it sleeps:
 * touch it and it wakes up, looks around, gets drowsy and nods off again.
 */

const pet = document.querySelector("[data-pet]");
const canvas = pet?.querySelector("canvas");
const g = canvas?.getContext("2d");

// the body, 18 × 13 (X = filled)
const BODY = [
    "......XXXXXX......",
    "...XXXXXXXXXXXX...",
    "..XXXXXXXXXXXXXX..",
    ".XXXXXXXXXXXXXXXX.",
    ".XXXXXXXXXXXXXXXX.",
    "XXXXXXXXXXXXXXXXXX",
    "XXXXXXXXXXXXXXXXXX",
    "XXXXXXXXXXXXXXXXXX",
    "XXXXXXXXXXXXXXXXXX",
    "XXXXXXXXXXXXXXXXXX",
    "XXXXXXXXXXXXXXXXXX",
    ".XXXXXXXXXXXXXXXX.",
    "..XXXXXXXXXXXXXX..",
];
// a Z, 5 × 5 (any smaller and the diagonal doesn't read), for when it sleeps
const Z = ["XXXXX", "...X.", "..X..", ".X...", "XXXXX"];
const LEFT = 1; // body starts one pixel in
const TOP = 7; // room above for the z

if (pet && canvas && g) {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isDark = () => document.documentElement.classList.contains("dark");

    // awake: woken up in the dark; drowsy: about to nod off again
    const state = { look: 0, blink: false, breath: 0, excited: false, z: 0, awake: false, drowsy: false };
    const sleeping = () => isDark() && !state.awake;

    const draw = () => {
        const css = getComputedStyle(pet);
        const fg = css.color;
        const bg = getComputedStyle(pet.closest(".site-footer") ?? document.body).backgroundColor;
        const asleep = sleeping();
        g.clearRect(0, 0, canvas.width, canvas.height);

        // breathing in: the body loses a row in the middle and sits a pixel lower
        const top = TOP + state.breath;
        g.fillStyle = fg;
        BODY.forEach((row, y) => {
            if (state.breath && y === 7) return;
            const yy = top + y - (state.breath && y > 7 ? 1 : 0);
            [...row].forEach((c, x) => c === "X" && g.fillRect(LEFT + x, yy, 1, 1));
        });

        // eyes, cut out of the body
        g.fillStyle = bg;
        const ey = top + 6;
        if (state.excited && !asleep) {
            // > <
            for (const [ex, dir] of [[4, 1], [13, -1]]) {
                const x0 = LEFT + ex;
                const tip = dir === 1 ? x0 + 1 : x0 - 1;
                g.fillRect(x0, ey - 1, 1, 1);
                g.fillRect(tip, ey, 1, 1);
                g.fillRect(x0, ey + 1, 1, 1);
            }
        } else {
            for (const ex of [5, 11]) {
                const x = LEFT + ex + state.look;
                if (asleep || state.drowsy || state.blink) g.fillRect(x, ey + 1, 2, 1);
                else g.fillRect(x, ey, 2, 2);
            }
        }

        // shadow: a dotted row under it
        g.fillStyle = fg;
        for (let x = 3; x < 17; x += 2) g.fillRect(LEFT + x - 1 + state.breath, TOP + 14, 1, 1);

        // asleep: a z drifting up from beside its head
        if (asleep && state.z < 3) {
            const zx = 15;
            const zy = 2 - state.z;
            Z.forEach((row, y) => [...row].forEach((c, x) => c === "X" && g.fillRect(zx + x, zy + y, 1, 1)));
        }
    };

    // breathing and the z: two frames, in steps
    let loop = 0;
    const startLoop = () => {
        if (loop || still.matches) return;
        loop = window.setInterval(() => {
            state.breath = state.breath ? 0 : 1;
            state.z = (state.z + 1) % 4;
            draw();
        }, 700);
    };
    const stopLoop = () => {
        window.clearInterval(loop);
        loop = 0;
        state.breath = 0;
        state.z = 0;
        draw();
    };

    // blinking now and then
    const blink = () => {
        window.setTimeout(() => {
            if (!still.matches && !sleeping() && !state.drowsy) {
                state.blink = true;
                draw();
                window.setTimeout(() => {
                    state.blink = false;
                    draw();
                }, 140);
            }
            blink();
        }, 2200 + Math.random() * 2600);
    };

    // the eyes follow the cursor left and right
    window.addEventListener("pointermove", (e) => {
        const r = pet.getBoundingClientRect();
        const look = e.clientX < r.left + r.width * 0.3 ? -1 : e.clientX > r.right - r.width * 0.3 ? 1 : 0;
        if (look !== state.look) {
            state.look = look;
            draw();
        }
    });

    // woken in the dark: awake for a bit, then drowsy, then back to sleep
    let napTimer = 0;
    const wake = () => {
        window.clearTimeout(napTimer);
        state.awake = isDark();
        state.drowsy = false;
    };
    const nodOff = () => {
        window.clearTimeout(napTimer);
        if (!state.awake) return;
        napTimer = window.setTimeout(() => {
            state.drowsy = true;
            draw();
            napTimer = window.setTimeout(() => {
                state.awake = false;
                state.drowsy = false;
                state.z = 0;
                draw();
            }, 1200);
        }, 2600);
    };

    // draw on screen only while the footer is in view
    const io = new IntersectionObserver((entries) => (entries[0].isIntersecting ? startLoop() : stopLoop()));
    io.observe(pet);
    still.addEventListener("change", (e) => (e.matches ? stopLoop() : startLoop()));
    // a change of theme: a fresh start (asleep in the dark, awake in the light)
    new MutationObserver(() => {
        window.clearTimeout(napTimer);
        state.awake = false;
        state.drowsy = false;
        draw();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    draw();
    blink();

    const range = () => Math.max(40, window.innerWidth / 2 - 140);
    Draggable.create(pet, {
        type: "x",
        bounds: { minX: -range(), maxX: range() },
        dragResistance: 0.2,
        onPress() {
            wake();
            state.excited = true;
            draw();
        },
        onRelease() {
            state.excited = false;
            draw();
            nodOff();
            // a little hop where it lands, in steps
            if (!still.matches) gsap.fromTo(pet, { y: 0 }, { y: -12, duration: 0.24, ease: "steps(3)", yoyo: true, repeat: 1 });
        },
    });

    window.addEventListener("resize", () => {
        const r = range();
        Draggable.get(pet)?.applyBounds({ minX: -r, maxX: r });
    });
}
