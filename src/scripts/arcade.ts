/**
 * The projects arcade: a close-up of an arcade cabinet ("Arcade Invaders" by
 * tef, CC BY 4.0) in three.js whose screen plays each project's clip
 * (public/media/arcade/<slug>.mp4) like an old TV: scanlines, a curved glass,
 * and a channel number in the corner when it changes. Changing project rolls
 * the picture up like a CRT losing vertical hold.
 *
 * The cabinet works:
 * - the sticks pivot at the panel like a real joystick, against a spring:
 *   push one left or right (drag it, or click it for a nudge) for the
 *   previous or next project; held over, it keeps going
 * - the left buttons each jump to a kind of project (Web, Mobile…)
 * - the right ones work the screen: pause, rewind, fast-forward, zoom,
 *   glitch, and a random project
 * - 1P, 2P and the screen open the project
 * Over a control, a tag says what it does.
 *
 * For the list, the camera moves in until the screen fills the box the page
 * gives it (screenBox), while the screen rolls over to the list; the page then
 * lays its own HTML list over it, drawn to the same measurements (LIST), so
 * the swap doesn't show. It only renders while it's on screen.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { gsap } from "gsap";

export interface ArcadeGame {
    num: string;
    title: string;
    category: string;
    year: string;
    href: string;
    types: string[];
    /** the clip for the screen and its first frame */
    video?: string;
    poster?: string;
    image?: string;
    inProgress: boolean;
}

export interface ArcadeOptions {
    canvas: HTMLCanvasElement;
    games: ArcadeGame[];
    reduceMotion: boolean;
    /** the visitor asked for the previous / next project, or a given one */
    onPrev: () => void;
    onNext: () => void;
    onPick: (i: number) => void;
    /** 1P, 2P or the screen */
    onOpen: () => void;
    /** the clip came to its end: true if the page moved on, otherwise it plays again */
    onEnded: () => boolean;
    /** the tag that says what a control does */
    tip: HTMLElement;
    /** where the screen should end up for the list, in page pixels (null: no zoom, e.g. on phones) */
    screenBox: () => DOMRect | null;
}

const MODEL = "/models/arcade.glb";
const MARQUEE_ASPECT = 3.3408;
// how much has to stay in view around the screen, half width / half height
const FRAME = { x: 0.2, y: 0.25 };
// in the site's colours (global.css): a black cabinet with paper trim, and
// blue on what you can press (the buttons and the sticks); the screens are
// ink glass with paper pixels
const SCREEN_BG = "#0e0e0e"; // --screen-bg
const PAPER = "#e9e7e2"; // --screen-text
const PALE = "#bdbbb6"; // paper, quieter: the small print
const BLUE = "#2f3dff"; // --blue
const paper = (alpha: number) => `rgba(233, 231, 226, ${alpha})`;
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const PIXEL = "Silkscreen, 'JetBrains Mono', monospace";
// four greys for the list's dithered thumbnails, ink to paper
const TONES = [
    [14, 14, 14],
    [70, 69, 67],
    [150, 148, 144],
    [233, 231, 226],
];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** the left buttons: a kind of project each (top row, then bottom row, as seen) */
const TYPE_BUTTONS: Record<string, { label: string; types: string[] }> = {
    Btn_L2: { label: "Web", types: ["web"] },
    Btn_L4: { label: "Mobile", types: ["mobile"] },
    Btn_L6: { label: "Full-stack & data", types: ["fullstack", "data"] },
    Btn_L1: { label: "Games & interactive", types: ["interactive"] },
    Btn_L3: { label: "Motion", types: ["motion"] },
    Btn_L5: { label: "UI & branding", types: ["ui", "branding"] },
};
/** the right buttons: the screen */
type ScreenAction = "pause" | "rewind" | "fast" | "zoom" | "glitch" | "random";
const SCREEN_BUTTONS: Record<string, ScreenAction> = {
    Btn_R2: "pause",
    Btn_R4: "rewind",
    Btn_R6: "fast",
    Btn_R1: "zoom",
    Btn_R3: "glitch",
    Btn_R5: "random",
};
const SPEEDS = [1, 2, 4];
const ZOOMS = [1, 1.8];
const REWIND_SECONDS = 3;

// the sticks: how far they lean before the gate stops them (radians), the
// spring that brings them back, and where they pivot (just under the panel)
const STICK_MAX = 0.36;
const STICK_SPRING = 900;
const STICK_DAMPING = 2 * Math.sqrt(STICK_SPRING) * 0.42;
const STICK_PIVOT_Y = -0.018;
// a drag this long (px) takes the stick to the gate
const STICK_DRAG = 46;

/**
 * The screens are drawn 1024 wide (the screen's own proportions). The list's
 * measurements, in those pixels: the HTML list in ProjectArcade.astro uses the
 * same ones, so the two line up.
 */
const W = 1024;
const H = 723;
export const LIST = {
    padX: 64,
    headBaseline: 74,
    rule: 94,
    rowsTop: 118,
    rowH: 62,
    rows: 8,
    thumb: { w: 72, h: 48 },
    numX: 156,
    textX: 206,
    hintBaseline: H - 44,
};

const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    uniform sampler2D uFrom;
    uniform sampler2D uTo;
    uniform sampler2D uOsd;
    uniform float uRoll;
    uniform float uTime;
    uniform float uHover;
    uniform float uFlat;
    uniform float uZoom;
    uniform float uGlitch;
    uniform float uTrack;
    uniform float uStatic;
    uniform float uSeed;
    uniform vec3 uTint;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    // one picture, zoomed in on its middle
    vec3 sampleOf(sampler2D t, vec2 q) {
        return texture2D(t, 0.5 + (q - 0.5) / uZoom).rgb;
    }

    vec3 picture(vec2 p) {
        // the old picture rolls up and away, the new one follows it from below
        float y = p.y - uRoll;
        vec3 col = y >= 0.0 ? sampleOf(uFrom, vec2(p.x, y)) : sampleOf(uTo, vec2(p.x, y + 1.0));
        // the dark bar between the two
        col *= 1.0 - (1.0 - smoothstep(0.0, 0.035, abs(y))) * step(0.001, uRoll) * step(uRoll, 0.999);
        return col;
    }

    void main() {
        // glTF UVs run top-down; flip them so y points up, like the textures
        vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
        vec2 c = uv - 0.5;
        // the glass bulges a little, except up close for the list (uFlat), where
        // the picture has to sit exactly where the page's list goes
        vec2 p0 = 0.5 + c * mix(0.95 + 0.1 * dot(c, c), 1.0, uFlat);
        vec2 p = p0;
        // rewinding: the lines wobble sideways, like a tape
        p.x += sin(p.y * 90.0 + uTime * 50.0) * 0.005 * uTrack;
        // a glitch: rows of the picture jump sideways
        float r = hash(vec2(floor(p.y * 28.0), floor(uTime * 18.0) + uSeed));
        p.x += (r - 0.5) * 0.32 * uGlitch * step(0.55, r);
        float split = 0.0012 + 0.02 * uGlitch;
        vec3 col = vec3(
            picture(p + vec2(split, 0.0)).r,
            picture(p).g,
            picture(p - vec2(split, 0.0)).b
        );
        // what the set says (channel, pause…), on the picture, under the glass
        vec4 osd = texture2D(uOsd, p0);
        col = mix(col, osd.rgb, osd.a);
        // scanlines, a slow band and a little flicker
        col *= 0.84 + 0.16 * sin(p.y * 820.0);
        col *= 0.97 + 0.03 * sin(p.y * 7.0 - uTime * 1.7);
        col *= 0.985 + 0.015 * sin(uTime * 53.0);
        // static: while it rolls, when the channel jumps, in the tape's noise band
        float n = hash(floor(p * vec2(300.0, 220.0)) + floor(uTime * 30.0));
        float band = 1.0 - smoothstep(0.0, 0.07, abs(fract(p.y + uTime * 0.9) - 0.5));
        float noise = max(max(sin(uRoll * 3.14159) * 0.55, uStatic), band * uTrack * 0.85);
        col = mix(col, uTint * n, noise);
        // darker towards the rounded corners, a touch brighter on hover
        col *= smoothstep(0.85, 0.35, length(c * vec2(1.0, 1.25))) * 0.5 + 0.5;
        col *= 1.0 + uHover * 0.08;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
    }
`;

const loadImage = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });

const newCanvas = (w = W, h = H) => Object.assign(document.createElement("canvas"), { width: w, height: h });

/** the image, covered into w × h and dithered into the four tones, in chunky pixels */
function dither(img: HTMLImageElement, w: number, h: number, px: number) {
    const cw = Math.ceil(w / px);
    const ch = Math.ceil(h / px);
    const small = newCanvas(cw, ch);
    const s = small.getContext("2d", { willReadFrequently: true })!;
    const scale = Math.max(cw / img.width, ch / img.height);
    s.drawImage(img, (cw - img.width * scale) / 2, (ch - img.height * scale) / 2, img.width * scale, img.height * scale);
    const data = s.getImageData(0, 0, cw, ch);
    const d = data.data;
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const i = (y * cw + x) * 4;
            const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
            // a bit of contrast, then pick one of four tones with an ordered dither
            const v = Math.min(1, Math.max(0, (l - 0.5) * 1.25 + 0.5)) * 3;
            const level = Math.min(3, Math.floor(v + BAYER[(y % 4) * 4 + (x % 4)] - 0.5 + 0.5));
            const [r, g, b] = TONES[Math.max(0, level)];
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
        }
    }
    s.putImageData(data, 0, 0);
    return small;
}

/** a screen's background: the ink glass */
function screenBase(g: CanvasRenderingContext2D) {
    g.fillStyle = SCREEN_BG;
    g.fillRect(0, 0, W, H);
    g.textBaseline = "alphabetic";
}

/** pixel letters in paper; returns the height used */
function pixelLines(g: CanvasRenderingContext2D, lines: string[], size: number, x: number, y: number) {
    g.font = `700 ${size}px ${PIXEL}`;
    const lineH = size * 1.05;
    g.fillStyle = PAPER;
    lines.forEach((l, i) => g.fillText(l, x, y + i * lineH));
    return lines.length * lineH;
}

// the pixel font has no long dash
const forPixels = (s: string) => s.toUpperCase().replace(/[—–]/g, "-");

const textureOf = (canvas: HTMLCanvasElement, flipY = true) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.flipY = flipY;
    return tex;
};

/** a still for the screen: the clip's first frame (or the project's image), covering it */
async function stillOf(game: ArcadeGame) {
    const canvas = newCanvas();
    const g = canvas.getContext("2d")!;
    screenBase(g);
    const src = game.poster ?? game.image;
    const img = src ? await loadImage(src) : null;
    if (img) {
        const s = Math.max(W / img.width, H / img.height);
        g.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    } else {
        pixelLines(g, [forPixels(game.title)], 56, 64, H / 2);
    }
    return textureOf(canvas);
}

/** text cut short with an ellipsis to fit max px */
function fitText(g: CanvasRenderingContext2D, text: string, max: number) {
    if (g.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
}

/** the list, as the page draws it in HTML (see LIST) */
function drawList(games: ArcadeGame[], visible: number[], label: string, thumbs: (HTMLCanvasElement | null)[]) {
    const canvas = newCanvas();
    const g = canvas.getContext("2d")!;
    screenBase(g);
    const L = LIST;
    const right = W - L.padX;

    g.font = `400 26px ${MONO}`;
    g.fillStyle = PALE;
    g.fillText(label.toUpperCase(), L.padX, L.headBaseline);
    g.textAlign = "right";
    g.fillText(`${String(visible.length).padStart(2, "0")} / ${String(games.length).padStart(2, "0")}`, right, L.headBaseline);
    g.textAlign = "left";
    g.fillStyle = PAPER;
    g.fillRect(L.padX, L.rule, right - L.padX, 3);

    visible.slice(0, L.rows).forEach((i, r) => {
        const game = games[i];
        const top = L.rowsTop + r * L.rowH;
        const thumb = thumbs[i];
        const ty = top + (L.rowH - L.thumb.h) / 2;
        if (thumb) {
            g.imageSmoothingEnabled = false;
            g.drawImage(thumb, L.padX, ty, L.thumb.w, L.thumb.h);
        }
        g.lineWidth = 2;
        g.strokeStyle = paper(0.5);
        g.strokeRect(L.padX + 1, ty + 1, L.thumb.w - 2, L.thumb.h - 2);

        g.fillStyle = PALE;
        g.font = `400 22px ${MONO}`;
        g.fillText(game.num, L.numX, top + 38);
        g.textAlign = "right";
        g.fillText(game.year, right, top + 38);
        const yearW = g.measureText(game.year).width;
        g.textAlign = "left";

        g.font = `700 28px ${PIXEL}`;
        g.fillStyle = PAPER;
        g.fillText(fitText(g, forPixels(game.title), right - L.textX - yearW - 24), L.textX, top + 30);
        g.font = `400 17px ${MONO}`;
        g.fillStyle = PALE;
        g.fillText(game.category.toUpperCase(), L.textX, top + 52);

        g.fillStyle = paper(0.15);
        g.fillRect(L.padX, top + L.rowH - 1, right - L.padX, 1);
    });

    g.font = `400 22px ${MONO}`;
    g.fillStyle = PAPER;
    g.fillText("↑↓ CHOOSE · ENTER START", L.padX, L.hintBaseline);
    g.textAlign = "right";
    g.fillStyle = PALE;
    g.fillText("ESC ARCADE", right, L.hintBaseline);
    g.textAlign = "left";
    return textureOf(canvas);
}

/** the marquee: "PROJECTS" in paper pixel letters in a frame, a blue pixel star either side */
function drawMarquee() {
    const MH = Math.round(W / MARQUEE_ASPECT);
    const canvas = newCanvas(W, MH);
    const g = canvas.getContext("2d")!;
    g.fillStyle = SCREEN_BG;
    g.fillRect(0, 0, W, MH);
    // (the top of the texture sits behind the cabinet's lip, so the frame starts lower)
    const frame = { x: 28, y: 84, w: W - 56, h: MH - 84 - 16 };
    g.strokeStyle = PAPER;
    g.lineWidth = 7;
    g.strokeRect(frame.x, frame.y, frame.w, frame.h);
    g.strokeStyle = BLUE;
    g.lineWidth = 2;
    g.strokeRect(frame.x + 14, frame.y + 14, frame.w - 28, frame.h - 28);

    // as big as fits between the stars
    g.font = `700 100px ${PIXEL}`;
    const size = Math.min(110, Math.floor((100 * (frame.w - 300)) / g.measureText("PROJECTS").width));
    g.font = `700 ${size}px ${PIXEL}`;
    const tw = g.measureText("PROJECTS").width;
    const cy = frame.y + frame.h / 2;
    pixelLines(g, ["PROJECTS"], size, (W - tw) / 2, cy + size * 0.36);

    // a pixel star each side
    const cell = 8;
    const STAR = ["..#..", ".###.", "#####", ".###.", "#.#.#"];
    g.fillStyle = BLUE;
    for (const sx of [(W - tw) / 2 - 100, (W + tw) / 2 + 60]) {
        STAR.forEach((row, r) => [...row].forEach((c, k) => c === "#" && g.fillRect(sx + k * cell, cy - 20 + r * cell, cell, cell)));
    }
    return textureOf(canvas, false); // glTF UVs run top-down
}

/**
 * What the set shows over the picture, like an old TV or VCR: the play state
 * top left (pause stays, the rest come and go), the channel top right, and a
 * message bottom left (the kind of project, the zoom…).
 */
type OsdIcon = "play" | "pause" | "fast" | "rewind";
function createOsd() {
    const canvas = newCanvas();
    const g = canvas.getContext("2d")!;
    const texture = textureOf(canvas);
    const PAD = 60;
    const SIZE = 38;
    const shadow = "rgba(14, 14, 14, 0.8)";
    let state = { icon: null as OsdIcon | null, iconText: "", channel: "", message: "" };
    const until = { icon: 0, channel: 0, message: 0 };
    let persistent: { icon: OsdIcon | null; text: string } = { icon: null, text: "" };

    // with a hard shadow, so it reads over any picture
    const text = (s: string, x: number, y: number, align: CanvasTextAlign = "left") => {
        g.font = `700 ${SIZE}px ${PIXEL}`;
        g.textAlign = align;
        g.fillStyle = shadow;
        g.fillText(s, x + 4, y + 4);
        g.fillStyle = PAPER;
        g.fillText(s, x, y);
        return g.measureText(s).width;
    };
    const icon = (kind: OsdIcon, x: number, y: number) => {
        const s = SIZE * 0.8; // y is the baseline: the icon sits on it
        const shape = (dx: number, dy: number) => {
            g.beginPath();
            if (kind === "pause") {
                g.rect(x + dx, y - s + dy, s * 0.32, s);
                g.rect(x + s * 0.56 + dx, y - s + dy, s * 0.32, s);
            } else if (kind === "play") {
                g.moveTo(x + dx, y - s + dy);
                g.lineTo(x + s * 0.86 + dx, y - s / 2 + dy);
                g.lineTo(x + dx, y + dy);
            } else {
                // two triangles, pointing forwards or back
                const dir = kind === "fast" ? 1 : -1;
                for (const k of [0, 1]) {
                    const x0 = x + k * s * 0.62 + dx + (dir < 0 ? s * 0.62 : 0);
                    g.moveTo(x0, y - s + dy);
                    g.lineTo(x0 + dir * s * 0.62, y - s / 2 + dy);
                    g.lineTo(x0, y + dy);
                }
            }
            g.fill();
        };
        g.fillStyle = shadow;
        shape(4, 4);
        g.fillStyle = PAPER;
        shape(0, 0);
        return kind === "pause" || kind === "play" ? s * 0.9 : s * 1.3;
    };

    const draw = () => {
        g.clearRect(0, 0, W, H);
        g.textBaseline = "alphabetic";
        if (state.icon) {
            const w = icon(state.icon, PAD, PAD + SIZE);
            if (state.iconText) text(state.iconText, PAD + w + 18, PAD + SIZE);
        }
        if (state.channel) text(state.channel, W - PAD, PAD + SIZE, "right");
        if (state.message) text(state.message, PAD, H - PAD);
        texture.needsUpdate = true;
    };

    const now = () => performance.now();
    const refresh = () => {
        const t = now();
        const next = {
            icon: until.icon > t ? state.icon : persistent.icon,
            iconText: until.icon > t ? state.iconText : persistent.text,
            channel: until.channel > t ? state.channel : "",
            message: until.message > t ? state.message : "",
        };
        if (JSON.stringify(next) !== JSON.stringify(state)) {
            state = next;
            draw();
        }
    };

    return {
        texture,
        /** a play state for a moment */
        flash(kind: OsdIcon, label: string, ms = 1300) {
            state = { ...state, icon: kind, iconText: label };
            until.icon = now() + ms;
            draw();
        },
        /** the play state that stays (paused, fast-forward) */
        hold(kind: OsdIcon | null, label = "") {
            persistent = { icon: kind, text: label };
            refresh();
        },
        channel(label: string, ms = 1800) {
            state = { ...state, channel: label };
            until.channel = now() + ms;
            draw();
        },
        message(label: string, ms = 1800) {
            state = { ...state, message: label };
            until.message = now() + ms;
            draw();
        },
        /** called every frame: clears what's had its time */
        tick: refresh,
        clear() {
            until.icon = until.channel = until.message = 0;
            refresh();
        },
    };
}

export async function createArcade(o: ArcadeOptions) {
    await Promise.all([document.fonts.load(`700 40px Silkscreen`), document.fonts.load(`400 24px 'JetBrains Mono'`)]).catch(() => {});

    const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    // 1.5 at most: full retina would be 1.8× the pixels for little visible gain
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0x2e2a30, 0.7));
    const top = new THREE.SpotLight(0xfff4f8, 3, 3, 0.7, 0.6);
    top.position.set(0, 1.5, 0.9);
    top.target.position.set(0, 0.6, 0);
    scene.add(top, top.target);
    // the screen's light spilling onto the cabinet (it's close: a little goes a long way)
    const spill = new THREE.PointLight(0xffffff, 0.06);
    spill.position.set(0, 0.73, 0.25);
    scene.add(spill);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
    // a close-up: from the buttons up to the marquee, looking down a little
    const target = new THREE.Vector3(0, 0.75, 0.08);
    const viewDir = new THREE.Vector3(0, 0.22, 1).normalize();

    const gltf = await new GLTFLoader().loadAsync(MODEL);
    scene.add(gltf.scene);

    // the cabinet, restyled by material: black, with paper trim and blue buttons
    const palette: Record<string, THREE.MeshStandardMaterialParameters> = {
        Body: { color: 0x0e0d10, roughness: 0.5, metalness: 0.1 },
        Side: { color: 0x121114, roughness: 0.5, metalness: 0.1 },
        Trim: { color: PAPER, roughness: 0.5, emissive: PAPER, emissiveIntensity: 0.12 },
        Button: { color: BLUE, roughness: 0.35, emissive: 0x0a1060, emissiveIntensity: 0.4 },
        ButtonPlayer: { color: PAPER, roughness: 0.35 },
        Metal: { color: 0x9a96a0, roughness: 0.3, metalness: 0.75 },
        Coin: { color: 0x1a191c, roughness: 0.5 },
        ScreenBack: { color: 0x050406, roughness: 0.9 },
        Screen: { color: 0x050406, roughness: 0.9 },
        Marquee: { color: 0x070608, roughness: 0.9 },
    };
    const made = new Map<string, THREE.MeshStandardMaterial>();
    const restyle = (m: THREE.Material) => {
        if (!made.has(m.name)) made.set(m.name, new THREE.MeshStandardMaterial({ name: m.name, ...(palette[m.name] ?? palette.Body) }));
        return made.get(m.name)!;
    };
    gltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(restyle) : restyle(mesh.material);
    });

    const part = (name: string) => gltf.scene.getObjectByName(name) as THREE.Mesh;
    const materialName = (obj: THREE.Object3D) => ((obj as THREE.Mesh).material as THREE.Material | undefined)?.name;
    const screen = part("Screen");
    const marquee = part("Marquee");
    // the cabinet's own glass sits in front of the screen plane: hide it, and
    // bring the plane forward of the bezel
    gltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh !== screen && materialName(mesh) === "Screen") mesh.visible = false;
    });
    const facing = new THREE.Vector3().fromBufferAttribute(screen.geometry.attributes.normal as THREE.BufferAttribute, 0).normalize();
    screen.position.addScaledVector(facing, 0.02);
    marquee.material = new THREE.MeshBasicMaterial({ map: drawMarquee(), toneMapped: false });
    // where the screen is and how tall, for the camera to move in on it
    gltf.scene.updateMatrixWorld(true);
    const screenCentre = screen.getWorldPosition(new THREE.Vector3());
    const corner = (i: number) => new THREE.Vector3().fromBufferAttribute(screen.geometry.attributes.position as THREE.BufferAttribute, i);
    const screenHeight = corner(0).distanceTo(corner(3));

    // ---- the controls: everything clickable, and what it does
    type Control =
        | { kind: "stick"; side: -1 | 1 }
        | { kind: "type"; label: string; types: string[] }
        | { kind: "screen"; action: ScreenAction }
        | { kind: "open" };
    const controls = new Map<THREE.Object3D, Control>();
    const stickL = part("Stick_L");
    const stickR = part("Stick_R");
    controls.set(stickL, { kind: "stick", side: -1 });
    controls.set(stickR, { kind: "stick", side: 1 });
    for (const [name, t] of Object.entries(TYPE_BUTTONS)) controls.set(part(name), { kind: "type", ...t });
    for (const [name, action] of Object.entries(SCREEN_BUTTONS)) controls.set(part(name), { kind: "screen", action });
    controls.set(part("Btn_1P"), { kind: "open" });
    controls.set(part("Btn_2P"), { kind: "open" });
    controls.set(screen, { kind: "open" });
    // each control gets its own materials, so it can light up on hover
    for (const obj of controls.keys()) {
        if (obj === screen) continue;
        obj.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : (mesh.material as THREE.Material).clone();
        });
    }

    // a button's cap goes down when pressed; its ring stays in the panel
    const capOf = (obj: THREE.Object3D) => obj.children.find((c) => materialName(c) === "Button") ?? obj;
    const capRest = new Map<THREE.Object3D, number>();
    for (const [obj, c] of controls) {
        if (c.kind !== "type" && c.kind !== "screen" && !(c.kind === "open" && obj !== screen)) continue;
        const cap = capOf(obj);
        capRest.set(cap, cap.position.y);
    }

    // a stick: its ball and shaft lean on a pivot just under the panel, its
    // dust washer stays where it is. The ball in blue, like the buttons
    const sticks = [stickL, stickR].map((stick) => {
        const pivot = new THREE.Group();
        pivot.position.set(0, STICK_PIVOT_Y, 0);
        stick.add(pivot);
        for (const child of [...stick.children]) {
            if (child === pivot || !(child as THREE.Mesh).isMesh) continue;
            if (materialName(child) !== "Body") pivot.attach(child);
            const std = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (std.name === "Button") {
                std.color.set(BLUE);
                std.emissive.set(0x0a1060);
            }
        }
        return {
            obj: stick as THREE.Object3D,
            pivot,
            // lean: x towards the viewer, z to the left (radians); where the spring pulls it
            lean: new THREE.Vector2(),
            speed: new THREE.Vector2(),
            aim: new THREE.Vector2(),
            // over to one side (-1, 1) and when it last moved the projects on, for holding it there
            over: 0,
            firedAt: 0,
        };
    });
    const stickOf = (obj: THREE.Object3D) => sticks.find((s) => s.obj === obj)!;

    // ---- the screen: two players taking turns, so one rolls in while the other rolls out
    const osd = createOsd();
    const blank = new THREE.DataTexture(new Uint8Array([14, 14, 14, 255]), 1, 1);
    blank.colorSpace = THREE.SRGBColorSpace;
    blank.needsUpdate = true;
    const none = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    none.needsUpdate = true;
    const uniforms = {
        uFrom: { value: blank as THREE.Texture },
        uTo: { value: blank as THREE.Texture },
        uOsd: { value: osd.texture as THREE.Texture },
        uRoll: { value: 0 },
        uTime: { value: 0 },
        uHover: { value: 0 },
        uFlat: { value: 0 },
        uZoom: { value: 1 },
        uGlitch: { value: 0 },
        uTrack: { value: 0 },
        uStatic: { value: 0 },
        uSeed: { value: 0 },
        uTint: { value: new THREE.Color(PAPER) },
    };
    screen.material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, toneMapped: false });

    const players = [0, 1].map(() => {
        const el = document.createElement("video");
        el.muted = true;
        el.defaultMuted = true;
        el.playsInline = true;
        el.preload = "auto";
        el.setAttribute("playsinline", "");
        const tex = new THREE.VideoTexture(el);
        tex.colorSpace = THREE.SRGBColorSpace;
        // a seek while paused (rewind) draws the frame it lands on
        el.addEventListener("seeked", () => (tex.needsUpdate = true));
        return { el, tex, game: -1, still: null as THREE.Texture | null };
    });
    let active = 0;
    const player = () => players[active];

    const stills = new Map<number, Promise<THREE.Texture>>();
    const stillFor = (i: number) => {
        if (!stills.has(i)) stills.set(i, stillOf(o.games[i]));
        return stills.get(i)!;
    };
    const thumbs = Promise.all(o.games.map(async (g) => (g.image ? loadImage(g.image) : null))).then((imgs) =>
        imgs.map((img) => (img ? dither(img, LIST.thumb.w, LIST.thumb.h, 3) : null)),
    );

    /** the picture rolls over to tex (or just changes, when asked or with reduced motion) */
    const rollTo = (tex: THREE.Texture, roll = true) => {
        gsap.killTweensOf(uniforms.uRoll);
        if (uniforms.uRoll.value > 0) uniforms.uFrom.value = uniforms.uTo.value;
        uniforms.uRoll.value = 0;
        uniforms.uTo.value = tex;
        if (!roll || o.reduceMotion || uniforms.uFrom.value === blank) {
            uniforms.uFrom.value = tex;
            return;
        }
        gsap.to(uniforms.uRoll, {
            value: 1,
            duration: 0.55,
            ease: "power2.inOut",
            onComplete: () => {
                // (whatever the new picture is by now: the still may have become the clip)
                uniforms.uFrom.value = uniforms.uTo.value;
                uniforms.uRoll.value = 0;
            },
        });
    };
    /** one picture for another, wherever it is on screen */
    const swap = (from: THREE.Texture, to: THREE.Texture) => {
        if (uniforms.uFrom.value === from) uniforms.uFrom.value = to;
        if (uniforms.uTo.value === from) uniforms.uTo.value = to;
    };

    // the set's state: playing (not with reduced motion until asked), speed, zoom
    let playing = !o.reduceMotion;
    let speed = 0;
    let zoom = 0;
    let listMode = false;
    let visible = false;
    let current = 0;
    let token = 0;
    const holdState = () => {
        if (!playing) osd.hold("pause", "PAUSE");
        else if (SPEEDS[speed] > 1) osd.hold("fast", `X${SPEEDS[speed]}`);
        else osd.hold(null);
    };
    const playActive = () => {
        const p = player();
        p.el.playbackRate = SPEEDS[speed];
        if (!playing || !visible || listMode || document.hidden || p.game !== current || p.el.readyState < 2) return;
        p.el
            .play()
            .then(() => {
                // playing: the clip takes over from its still
                if (p !== player() || !p.still) return;
                swap(p.still, p.tex);
                p.still = null;
            })
            .catch(() => {});
    };

    /** show game i: its still straight away, then its clip once it can play */
    const show = async (i: number) => {
        current = i;
        const me = ++token;
        const game = o.games[i];
        if (!listMode) osd.channel(`CH ${game.num}`);
        const still = await stillFor(i);
        if (me !== token || listMode) return;
        rollTo(still);
        stillFor((i + 1) % o.games.length);
        if (!game.video) return;

        // the clip goes in the other player; the one on screen stops once it has rolled away
        const out = player();
        active = 1 - active;
        const p = player();
        p.game = i;
        p.still = still;
        p.el.src = game.video;
        p.el.playbackRate = SPEEDS[speed];
        window.setTimeout(() => {
            if (out !== player()) out.el.pause();
        }, 700);
        await new Promise<void>((resolve) => {
            const done = () => {
                p.el.removeEventListener("loadeddata", done);
                p.el.removeEventListener("error", done);
                resolve();
            };
            p.el.addEventListener("loadeddata", done);
            p.el.addEventListener("error", done);
            window.setTimeout(done, 5000);
        });
        if (me !== token || listMode) return;
        playActive();
    };
    for (const p of players) {
        p.el.addEventListener("ended", () => {
            if (p !== player() || listMode) return;
            if (o.onEnded()) return;
            p.el.currentTime = 0;
            playActive();
        });
    }

    // ---- the right-hand buttons: the screen
    const screenDo = (action: ScreenAction) => {
        const p = player();
        if (action === "pause") {
            playing = !playing;
            if (playing) {
                osd.flash("play", "PLAY");
                playActive();
            } else p.el.pause();
            holdState();
        } else if (action === "rewind") {
            if (p.game === current) p.el.currentTime = Math.max(0, p.el.currentTime - REWIND_SECONDS);
            osd.flash("rewind", "REWIND", 1100);
            if (!o.reduceMotion) gsap.fromTo(uniforms.uTrack, { value: 1 }, { value: 0, duration: 0.7, ease: "power2.in" });
        } else if (action === "fast") {
            speed = (speed + 1) % SPEEDS.length;
            p.el.playbackRate = SPEEDS[speed];
            if (SPEEDS[speed] === 1) osd.flash("play", "X1", 1000);
            holdState();
        } else if (action === "zoom") {
            zoom = (zoom + 1) % ZOOMS.length;
            gsap.to(uniforms.uZoom, { value: ZOOMS[zoom], duration: o.reduceMotion ? 0 : 0.5, ease: "power3.inOut" });
            osd.message(ZOOMS[zoom] > 1 ? `ZOOM X${ZOOMS[zoom]}` : "ZOOM X1", 1200);
        } else if (action === "glitch") {
            uniforms.uSeed.value = Math.random() * 100;
            if (o.reduceMotion) osd.message("GLITCH", 900);
            else gsap.fromTo(uniforms.uGlitch, { value: 1 }, { value: 0, duration: 0.9, ease: "power2.in" });
        } else if (action === "random") {
            const n = o.games.length;
            const i = (current + 1 + Math.floor(Math.random() * (n - 1))) % n;
            if (!o.reduceMotion) gsap.fromTo(uniforms.uStatic, { value: 0.9 }, { value: 0, duration: 0.6, ease: "power2.in" });
            o.onPick(i);
            osd.message("RANDOM");
        }
    };

    // ---- the left-hand buttons: the next project of a kind, after this one
    const ofType = (types: string[]) => o.games.flatMap((g, i) => (g.types.some((t) => types.includes(t)) ? [i] : []));
    const typeDo = (label: string, types: string[]) => {
        const all = ofType(types);
        if (!all.length) return;
        const i = all.find((k) => k > current) ?? all[0];
        if (i !== current) o.onPick(i);
        osd.message(`${forPixels(label)} ${all.indexOf(i) + 1}/${all.length}`);
    };

    // ---- the list
    let listTex: THREE.Texture | null = null;
    let listArgs: [number[], string] = [o.games.map((_, i) => i), "Select project"];
    /** the list on the screen: these games, under this heading */
    const setList = async (visibleGames: number[], label: string) => {
        listArgs = [visibleGames, label];
        const tex = drawList(o.games, visibleGames, label, await thumbs);
        listTex?.dispose();
        listTex = tex;
        if (listMode) rollTo(tex, false);
        return tex;
    };

    // ---- the camera: on the cabinet (zoom 0) or right up to the screen (zoom 1)
    const home = new THREE.Vector3();
    const listPos = new THREE.Vector3();
    const look = new THREE.Vector3();
    const drift = new THREE.Vector2();
    const view = { zoom: 0, arcadeOff: 0, listOffX: 0, listOffY: 0, listReady: false };
    const placeCamera = () => {
        const { clientWidth: w, clientHeight: h } = o.canvas;
        if (!w || !h) return;
        const z = view.listReady ? view.zoom : 0;
        camera.position.set(home.x + drift.x * (1 - z), home.y + drift.y * (1 - z), home.z).lerp(listPos, z);
        camera.lookAt(look.lerpVectors(target, screenCentre, z));
        camera.setViewOffset(w, h, THREE.MathUtils.lerp(view.arcadeOff, -view.listOffX, z), -view.listOffY * z, w, h);
        camera.updateProjectionMatrix();
        uniforms.uFlat.value = z;
    };
    // keep the screen, marquee and controls in frame at any aspect ratio. The
    // page can move the cabinet off-centre to the right (CSS --view-shift, a
    // fraction of the width), to leave room for text on the left.
    const fit = () => {
        const { clientWidth: w, clientHeight: h } = o.canvas;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const shift = parseFloat(getComputedStyle(o.canvas).getPropertyValue("--view-shift")) || 0;
        view.arcadeOff = -shift * w;
        const vfov = THREE.MathUtils.degToRad(camera.fov);
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect * (1 - 2 * shift));
        home.copy(target).addScaledVector(viewDir, Math.max(FRAME.x / Math.tan(hfov / 2), FRAME.y / Math.tan(vfov / 2)));
        // up close: straight at the screen, as far back as makes it as tall as the box
        const box = o.screenBox();
        view.listReady = !!box?.height;
        if (box?.height) {
            const c = o.canvas.getBoundingClientRect();
            listPos.copy(screenCentre).addScaledVector(facing, screenHeight / (2 * Math.tan(vfov / 2) * (box.height / h)));
            view.listOffX = box.left + box.width / 2 - (c.left + w / 2);
            view.listOffY = box.top + box.height / 2 - (c.top + h / 2);
        }
        placeCamera();
    };

    // ---- pointer (the cabinet's controls, only while looking at the cabinet)
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const cursor = { x: 0, y: 0 };
    const clickable = [...controls.keys()];
    let hovered: THREE.Object3D | null = null;
    const controlOf = (obj: THREE.Object3D | null) => {
        for (let p = obj; p; p = p.parent) if (controls.has(p)) return p;
        return null;
    };
    const pick = (e: PointerEvent) => {
        const r = o.canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        return controlOf(ray.intersectObjects(clickable, true)[0]?.object ?? null);
    };
    // what a control does, for its tag
    const counts = (types: string[]) => ofType(types).length;
    const labelOf = (obj: THREE.Object3D) => {
        const c = controls.get(obj)!;
        if (c.kind === "stick") return "Drag ← →";
        if (c.kind === "open") return "Open project";
        if (c.kind === "type") return `${c.label} · ${counts(c.types)}`;
        return {
            pause: playing ? "Pause" : "Play",
            rewind: "Rewind",
            fast: SPEEDS[(speed + 1) % SPEEDS.length] > 1 ? `Fast-forward ×${SPEEDS[(speed + 1) % SPEEDS.length]}` : "Normal speed",
            zoom: ZOOMS[zoom] > 1 ? "Zoom out" : "Zoom in",
            glitch: "Glitch",
            random: "Random project",
        }[c.action];
    };
    let tipTimer = 0;
    const showTip = (obj: THREE.Object3D | null, e: PointerEvent) => {
        window.clearTimeout(tipTimer);
        if (!obj) {
            o.tip.hidden = true;
            return;
        }
        const r = o.canvas.getBoundingClientRect();
        o.tip.textContent = labelOf(obj);
        o.tip.hidden = false;
        o.tip.style.transform = `translate(${Math.round(e.clientX - r.left + 18)}px, ${Math.round(e.clientY - r.top + 20)}px)`;
    };
    // a control lights up in its own colour while the cursor is on it
    const glow = (obj: THREE.Object3D | null, on: boolean) => {
        if (!obj) return;
        if (obj === screen) {
            uniforms.uHover.value = on ? 1 : 0;
            return;
        }
        obj.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                const std = m as THREE.MeshStandardMaterial;
                std.userData.rest ??= { emissive: std.emissive.clone(), intensity: std.emissiveIntensity };
                if (on) {
                    std.emissive.copy(std.color);
                    std.emissiveIntensity = 0.9;
                } else {
                    std.emissive.copy(std.userData.rest.emissive);
                    std.emissiveIntensity = std.userData.rest.intensity;
                }
            }
        });
    };
    const unhover = () => {
        glow(hovered, false);
        hovered = null;
        o.canvas.style.cursor = "";
        o.tip.hidden = true;
    };

    // a button: the cap goes down while held, and comes back up with a little bounce
    const capDown = (obj: THREE.Object3D) => {
        const cap = capOf(obj);
        const rest = capRest.get(cap);
        if (rest === undefined) return;
        gsap.to(cap.position, { y: rest - 0.0035, duration: 0.05, ease: "power2.out", overwrite: true });
    };
    const capUp = (obj: THREE.Object3D) => {
        const cap = capOf(obj);
        const rest = capRest.get(cap);
        if (rest === undefined) return;
        gsap.to(cap.position, { y: rest, duration: 0.16, ease: "back.out(3)", overwrite: true });
    };

    // a stick, pushed: towards the gate, held a moment, then let go
    const flick = (stick: (typeof sticks)[number], dir: -1 | 1) => {
        stick.aim.set(0, -dir * STICK_MAX);
        window.setTimeout(() => {
            if (drag?.stick !== stick) stick.aim.set(0, 0);
        }, 150);
    };

    // dragging a stick: it leans after the pointer; past most of the way to the
    // gate it moves the projects on once, and again and again while held there
    let drag: { stick: (typeof sticks)[number]; id: number; x: number; y: number; t: number; moved: boolean } | null = null;
    let pressed: THREE.Object3D | null = null;
    const nudge = (dir: -1 | 1) => (dir < 0 ? o.onPrev() : o.onNext());

    o.canvas.addEventListener("pointerdown", (e) => {
        if (listMode || view.zoom > 0 || e.button !== 0) return;
        const hit = pick(e);
        if (!hit) return;
        const c = controls.get(hit)!;
        if (e.pointerType !== "mouse") showTip(hit, e);
        if (c.kind === "stick") {
            drag = { stick: stickOf(hit), id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
            o.canvas.setPointerCapture(e.pointerId);
            e.preventDefault();
            return;
        }
        o.canvas.setPointerCapture(e.pointerId);
        pressed = hit;
        if (c.kind === "open") {
            if (hit !== screen) capDown(hit);
            return;
        }
        // arcade buttons act as they go down
        capDown(hit);
        if (c.kind === "type") typeDo(c.label, c.types);
        else screenDo(c.action);
        if (hovered === hit) showTip(hit, e);
    });
    const release = (e: PointerEvent) => {
        if (drag && e.pointerId === drag.id) {
            const { stick, moved, t } = drag;
            drag = null;
            if (o.canvas.hasPointerCapture(e.pointerId)) o.canvas.releasePointerCapture(e.pointerId);
            // a click, not a drag: a nudge the way that stick sends you (left back, right on)
            if (!moved && performance.now() - t < 400) {
                const dir = stick.obj === stickL ? -1 : 1;
                flick(stick, dir);
                nudge(dir);
            } else stick.aim.set(0, 0);
            return;
        }
        if (!pressed) return;
        const hit = pressed;
        pressed = null;
        if (o.canvas.hasPointerCapture(e.pointerId)) o.canvas.releasePointerCapture(e.pointerId);
        capUp(hit);
        // the screen and 1P / 2P open the project when let go on them
        if (controls.get(hit)?.kind === "open" && e.type === "pointerup" && pick(e) === hit) o.onOpen();
    };
    o.canvas.addEventListener("pointerup", release);
    o.canvas.addEventListener("pointercancel", release);

    o.canvas.addEventListener("pointermove", (e) => {
        if (listMode || view.zoom > 0) return;
        if (drag && e.pointerId === drag.id) {
            const dx = e.clientX - drag.x;
            const dy = e.clientY - drag.y;
            if (Math.hypot(dx, dy) > 4) drag.moved = true;
            // right leans it right (z down), down leans it towards you (x up)
            const aim = new THREE.Vector2(dy / STICK_DRAG, -dx / STICK_DRAG);
            if (aim.length() > 1) aim.normalize();
            drag.stick.aim.copy(aim.multiplyScalar(STICK_MAX));
            return;
        }
        const hit = pick(e);
        // the view drifts with the cursor, but holds still over a control
        if (e.pointerType === "mouse" && !o.reduceMotion && !hit) {
            cursor.x = ndc.x;
            cursor.y = ndc.y;
        }
        if (hit !== hovered) {
            glow(hovered, false);
            glow(hit, true);
            hovered = hit;
        }
        if (e.pointerType === "mouse") showTip(hit, e);
        o.canvas.style.cursor = hit ? "pointer" : "";
    });
    o.canvas.addEventListener("pointerleave", () => {
        cursor.x = cursor.y = 0;
        if (!drag) unhover();
    });
    // a touch shows its tag for a moment
    o.canvas.addEventListener("pointerup", (e) => {
        if (e.pointerType !== "mouse") tipTimer = window.setTimeout(() => (o.tip.hidden = true), 1200);
    });

    /** to the list (in on the screen) or back to the cabinet; resolves when the camera gets there */
    const setMode = (mode: "arcade" | "list", animate = true) =>
        new Promise<void>((resolve) => {
            listMode = mode === "list";
            unhover();
            cursor.x = cursor.y = 0;
            token++;
            // up close, the list is the picture: nothing over it, no zoom
            osd.clear();
            uniforms.uOsd.value = listMode ? none : osd.texture;
            gsap.killTweensOf(uniforms.uZoom);
            uniforms.uZoom.value = listMode ? 1 : ZOOMS[zoom];
            if (listMode) {
                player().el.pause();
                if (listTex) rollTo(listTex, animate);
                else setList(...listArgs).then((tex) => rollTo(tex, animate));
            } else show(current);
            fit();
            gsap.killTweensOf(view);
            const z = listMode ? 1 : 0;
            if (!animate || o.reduceMotion) {
                view.zoom = z;
                placeCamera();
                resolve();
                return;
            }
            gsap.to(view, { zoom: z, duration: 1.2, ease: "power3.inOut", onUpdate: placeCamera, onComplete: resolve });
        });

    fit();
    new ResizeObserver(fit).observe(o.canvas);
    holdState();

    // ---- every frame: the sticks' springs, the set's messages, the picture
    const stepSticks = (dt: number) => {
        for (const s of sticks) {
            if (o.reduceMotion) s.lean.copy(s.aim);
            else {
                // a few small steps: a stiff spring needs them
                const n = 4;
                const h = dt / n;
                for (let k = 0; k < n; k++) {
                    s.speed.x += (STICK_SPRING * (s.aim.x - s.lean.x) - STICK_DAMPING * s.speed.x) * h;
                    s.speed.y += (STICK_SPRING * (s.aim.y - s.lean.y) - STICK_DAMPING * s.speed.y) * h;
                    s.lean.addScaledVector(s.speed, h);
                    // the gate: a ring it can't lean past; it stops dead there
                    const len = s.lean.length();
                    if (len > STICK_MAX) {
                        s.lean.multiplyScalar(STICK_MAX / len);
                        const out = s.speed.dot(s.lean) / (STICK_MAX * STICK_MAX);
                        if (out > 0) s.speed.addScaledVector(s.lean, -out);
                    }
                }
            }
            s.pivot.rotation.set(s.lean.x, 0, s.lean.y);

            // held over to one side: on to the next project, and again every so often
            if (drag?.stick === s) {
                const side = -s.lean.y / STICK_MAX;
                const now = performance.now();
                if (Math.abs(side) > 0.75) {
                    const dir = side > 0 ? 1 : -1;
                    if (s.over !== dir) {
                        s.over = dir;
                        s.firedAt = now + 250;
                        nudge(dir);
                    } else if (now - s.firedAt > 550) {
                        s.firedAt = now;
                        nudge(dir);
                    }
                } else if (Math.abs(side) < 0.35) s.over = 0;
            } else s.over = 0;
        }
    };

    const startedAt = performance.now();
    let last = startedAt;
    let raf = 0;
    const frame = () => {
        raf = requestAnimationFrame(frame);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        uniforms.uTime.value = (now - startedAt) / 1000;
        stepSticks(dt);
        osd.tick();
        if (!o.reduceMotion) {
            // a little parallax: the camera eases after the cursor (on the cabinet)
            drift.x += (cursor.x * 0.07 - drift.x) * 0.05;
            drift.y += (cursor.y * 0.04 - drift.y) * 0.05;
            placeCamera();
        }
        renderer.render(scene, camera);
    };
    // render, and play the clip, only while it's on screen
    const run = () => {
        const go = visible && !document.hidden;
        if (go && !raf) {
            last = performance.now();
            frame();
            playActive();
        } else if (!go && raf) {
            cancelAnimationFrame(raf);
            raf = 0;
            player().el.pause();
        }
    };
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        run();
    }).observe(o.canvas);
    document.addEventListener("visibilitychange", run);

    return {
        show,
        setList,
        setMode,
        /** the left stick, pushed one way (the page's arrows and keys) */
        nudge: (dir: -1 | 1) => flick(sticks[0], dir),
        /** a message on the screen for a moment */
        message: (text: string) => osd.message(forPixels(text)),
        /** measure again (the page's layout changed) */
        refit: fit,
        get visible() {
            return visible && !document.hidden;
        },
    };
}

export type Arcade = Awaited<ReturnType<typeof createArcade>>;
