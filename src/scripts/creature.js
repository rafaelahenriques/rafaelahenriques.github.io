import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";

gsap.registerPlugin(Draggable);

/*
 * The footer pet, a palanca negra, in pixels: one canvas pixel per square,
 * drawn in the footer's text colour. It breathes and blinks, turns to face the
 * cursor, squeezes its eye shut (>) while dragged, and in dark mode it lies
 * down to sleep: touch it and it stands up, gets drowsy and lies down again.
 * Hovering or pressing it shows a fact in a speech bubble (footer.astro).
 */

const pet = document.querySelector("[data-pet]");
const canvas = pet?.querySelector("canvas");
const g = canvas?.getContext("2d");

// the palanca, 32 × 24, facing right (X = filled). Each pose says which row it
// loses when it breathes in, and where its eye (2 × 2) and pale cheek are cut out
const STANDING = {
    breathRow: 16,
    eye: { x: 23, y: 8 },
    cheek: [[23, 11], [24, 11], [25, 11]],
    rows: [
        "..............XXXXXXX...........",
        "...........XXXX.....XXX.........",
        ".........XXX..........XX........",
        "........XX...XXXXXX....XX.......",
        ".......XX..XXX....XXX...X.......",
        ".......X...X........XX..XX......",
        ".................XX..XXXXX......",
        "..................XXXXXXXXX.....",
        ".................XXXXXXXXXXX....",
        "................XXXXXXXXXXXXX...",
        "...............XXXXXXXXXXXXXXX..",
        "..............XXXXXXXXXXXXXXXXX.",
        "...........XXXXXXXXXXXXXXXXXXXXX",
        ".....XXXXXXXXXXXXXXXXXXXX.XXXXXX",
        "..XXXXXXXXXXXXXXXXXXXXXX...XXXXX",
        ".XXXXXXXXXXXXXXXXXXXXXXX....XXX.",
        ".XXXXXXXXXXXXXXXXXXXXXX.........",
        "X.XXXXXXXXXXXXXXXXXXXXX.........",
        "X.XXXXXXXXXXXXXXXXXXXXX.........",
        "XX.XXXXXXXXXXXXXXXXXXXX.........",
        "XX.XXXX...........XXXX..........",
        "...XXX.X........X.XXX...........",
        "...XX..X........X..XX...........",
        "...XX..X........X..XX...........",
    ],
};
// asleep: lying down, legs folded under it, head low
const LYING = {
    breathRow: 19,
    eye: { x: 23, y: 15 },
    cheek: [],
    rows: [
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "..............XXXXXXX...........",
        "...........XXXX.....XXX.........",
        ".........XXX..........XX........",
        "........XX...XXXXXX....XX.......",
        ".......XX..XXX....XXX...X.......",
        ".......X...X........XX..XX......",
        ".................XX..XXXXX......",
        "..................XXXXXXXXX.....",
        ".................XXXXXXXXXXX....",
        "................XXXXXXXXXXXXX...",
        "......XXXXXXXXXXXXXXXXXXXXXXXX..",
        "...XXXXXXXXXXXXXXXXXXXXXXXXXXXX.",
        "..XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        ".XXXXXXXXXXXXXXXXXXXXXXXXX.XXXXX",
        ".XXXXXXXXXXXXXXXXXXXXXXXX...XXXX",
        "XXXXXXXXXXXXXXXXXXXXXXXXX....XX.",
        "XX.XXXXXXXXXXXXXXXXXXXXXXXXX....",
    ],
};
const WIDTH = STANDING.rows[0].length;
const HEIGHT = STANDING.rows.length;
// a Z, 5 × 5 (any smaller and the diagonal doesn't read), for when it sleeps
const Z = ["XXXXX", "...X.", "..X..", ".X...", "XXXXX"];
const LEFT = 1; // the sprite starts one pixel in
const TOP = 1;

if (pet && canvas && g) {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isDark = () => document.documentElement.classList.contains("dark");

    // face: 1 looking right, -1 looking left; awake: woken up in the dark; drowsy: about to nod off again
    const state = { face: 1, blink: false, breath: 0, excited: false, z: 0, awake: false, drowsy: false };
    const sleeping = () => isDark() && !state.awake;

    // a sprite pixel, mirrored when it faces left
    const px = (x, y) => g.fillRect(LEFT + (state.face > 0 ? x : WIDTH - 1 - x), y, 1, 1);

    const draw = () => {
        const css = getComputedStyle(pet);
        const fg = css.color;
        const bg = getComputedStyle(pet.closest(".site-footer") ?? document.body).backgroundColor;
        const asleep = sleeping();
        const pose = asleep ? LYING : STANDING;
        const { eye } = pose;
        g.clearRect(0, 0, canvas.width, canvas.height);

        // breathing in: the body loses a row and sits a pixel lower; what's under it stays put
        const rowY = (y) => TOP + y + (state.breath && y < pose.breathRow ? 1 : 0);
        g.fillStyle = fg;
        pose.rows.forEach((row, y) => {
            if (state.breath && y === pose.breathRow) return;
            [...row].forEach((c, x) => c === "X" && px(x, rowY(y)));
        });

        // the eye and the cheek, cut out of the head
        g.fillStyle = bg;
        pose.cheek.forEach(([x, y]) => px(x, rowY(y)));
        if (state.excited && !asleep) {
            // >, or < when it faces left
            px(eye.x, rowY(eye.y) - 1);
            px(eye.x + 1, rowY(eye.y));
            px(eye.x, rowY(eye.y) + 1);
        } else {
            const y = rowY(eye.y);
            px(eye.x, y + 1);
            px(eye.x + 1, y + 1);
            if (!asleep && !state.drowsy && !state.blink) {
                px(eye.x, y);
                px(eye.x + 1, y);
            }
        }

        // shadow: a dotted row under it
        g.fillStyle = fg;
        for (let x = 2; x < 24; x += 2) px(x, TOP + HEIGHT + 1);

        // asleep: a z drifting up from above its nose (the letter itself is never mirrored)
        if (asleep && state.z < 3) {
            const zx = state.face > 0 ? LEFT + WIDTH - 5 : LEFT;
            const zy = 8 - state.z;
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

    const turn = (face) => {
        if (face === state.face || sleeping()) return;
        state.face = face;
        draw();
    };

    // it turns to face the cursor (over its middle it stays as it is)
    window.addEventListener("pointermove", (e) => {
        const r = pet.getBoundingClientRect();
        if (e.clientX < r.left + r.width * 0.3) turn(-1);
        else if (e.clientX > r.right - r.width * 0.3) turn(1);
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
    // a change of theme: a fresh start (asleep in the dark, awake in the light).
    // Other classes come and go on <html> too; only the theme counts
    let dark = isDark();
    new MutationObserver(() => {
        if (isDark() === dark) return;
        dark = isDark();
        window.clearTimeout(napTimer);
        state.awake = false;
        state.drowsy = false;
        draw();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    draw();
    blink();

    // pressing shows the fact too, so it can be read on a phone
    let factTimer = 0;
    const range = () => Math.max(40, window.innerWidth / 2 - 140);
    Draggable.create(pet, {
        type: "x",
        bounds: { minX: -range(), maxX: range() },
        dragResistance: 0.2,
        onPress() {
            wake();
            state.excited = true;
            window.clearTimeout(factTimer);
            pet.classList.add("is-telling");
            draw();
        },
        onDrag() {
            // it looks where it's being carried, and the bubble moves to the side with more room
            if (this.deltaX) turn(this.deltaX > 0 ? 1 : -1);
            pet.classList.toggle("tells-left", this.x > 0);
        },
        onRelease() {
            state.excited = false;
            draw();
            nodOff();
            factTimer = window.setTimeout(() => pet.classList.remove("is-telling"), 4000);
            // a little hop where it lands, in steps
            if (!still.matches) gsap.fromTo(pet, { y: 0 }, { y: -12, duration: 0.24, ease: "steps(3)", yoyo: true, repeat: 1 });
        },
    });

    window.addEventListener("resize", () => {
        const r = range();
        Draggable.get(pet)?.applyBounds({ minX: -r, maxX: r });
    });
}
