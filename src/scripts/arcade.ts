/**
 * The projects arcade: a close-up of an arcade cabinet ("Arcade Invaders" by
 * tef, CC BY 4.0) in three.js whose screen flips through the projects. Each
 * project is drawn as a dark screen in neon (its image dithered into four
 * tones of it, its title in pixel letters, number, category, "press start");
 * changing project rolls the picture up like a CRT losing vertical hold. The
 * cabinet works: the left stick and buttons go back, the right ones forward,
 * 1P / 2P and the screen open the project.
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
    image?: string;
    inProgress: boolean;
}

export interface ArcadeOptions {
    canvas: HTMLCanvasElement;
    games: ArcadeGame[];
    reduceMotion: boolean;
    /** the visitor asked for the previous / next project */
    onPrev: () => void;
    onNext: () => void;
    /** 1P, 2P or the screen */
    onOpen: () => void;
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
// four greys for the dithered pictures, ink to paper (photos are black and white)
const TONES = [
    [14, 14, 14],
    [70, 69, 67],
    [150, 148, 144],
    [233, 231, 226],
];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

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
    uniform float uRoll;
    uniform float uTime;
    uniform float uHover;
    uniform float uFlat;
    uniform vec3 uTint;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    vec3 picture(vec2 p) {
        // the old picture rolls up and away, the new one follows it from below
        float y = p.y - uRoll;
        vec3 col = y >= 0.0 ? texture2D(uFrom, vec2(p.x, y)).rgb : texture2D(uTo, vec2(p.x, y + 1.0)).rgb;
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
        vec2 p = 0.5 + c * mix(0.95 + 0.1 * dot(c, c), 1.0, uFlat);
        vec3 col = vec3(
            picture(p + vec2(0.0012, 0.0)).r,
            picture(p).g,
            picture(p - vec2(0.0012, 0.0)).b
        );
        // scanlines, a slow band and a little flicker
        col *= 0.84 + 0.16 * sin(p.y * 820.0);
        col *= 0.97 + 0.03 * sin(p.y * 7.0 - uTime * 1.7);
        col *= 0.985 + 0.015 * sin(uTime * 53.0);
        // static while it rolls
        float n = hash(floor(p * vec2(300.0, 220.0)) + floor(uTime * 30.0));
        col = mix(col, uTint * n, sin(uRoll * 3.14159) * 0.55);
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

/** one project's screen */
async function drawScreen(game: ArcadeGame, total: number) {
    const canvas = newCanvas();
    const g = canvas.getContext("2d")!;
    screenBase(g);

    const pad = 64;
    g.fillStyle = PALE;
    g.font = `400 26px ${MONO}`;
    g.fillText(`PROJECT ${game.num} / ${String(total).padStart(2, "0")}`, pad, pad + 10);
    g.textAlign = "right";
    g.fillText(game.year, W - pad, pad + 10);
    g.textAlign = "left";
    g.fillStyle = PAPER;
    g.fillRect(pad, pad + 30, W - pad * 2, 3);

    // the picture, dithered, on the left
    const box = { x: pad, y: pad + 64, w: 400, h: H - pad * 2 - 64 };
    const img = game.image ? await loadImage(game.image) : null;
    if (img) {
        g.imageSmoothingEnabled = false;
        g.drawImage(dither(img, box.w, box.h, 4), box.x, box.y, box.w, box.h);
    } else {
        g.fillStyle = paper(0.08);
        g.fillRect(box.x, box.y, box.w, box.h);
    }
    g.lineWidth = 4;
    g.strokeStyle = PAPER;
    g.strokeRect(box.x, box.y, box.w, box.h);

    // the title in pixel letters, as big as fits beside it
    const tx = box.x + box.w + 52;
    const tw = W - pad - tx;
    const words = forPixels(game.title).split(/\s+/);
    let size = 72;
    let lines: string[] = [];
    for (; size >= 28; size -= 2) {
        g.font = `700 ${size}px ${PIXEL}`;
        lines = [];
        let line = "";
        for (const word of words) {
            const tryLine = line ? `${line} ${word}` : word;
            if (g.measureText(tryLine).width <= tw) line = tryLine;
            else {
                if (line) lines.push(line);
                line = word;
            }
        }
        if (line) lines.push(line);
        const fits = lines.every((l) => g.measureText(l).width <= tw);
        if (fits && lines.length * size * 1.05 <= 300) break;
    }
    const titleH = pixelLines(g, lines, size, tx, box.y + size * 0.8);
    const y = box.y + titleH + 30;
    g.fillStyle = PALE;
    g.font = `400 26px ${MONO}`;
    g.fillText(game.category.toUpperCase(), tx, y);
    if (game.inProgress) {
        // like the site's in-progress tag: inverted, with a pixel
        const label = "IN PROGRESS";
        const lw = g.measureText(label).width + 56;
        g.fillStyle = PAPER;
        g.fillRect(tx, y + 26, lw, 42);
        g.fillStyle = SCREEN_BG;
        g.fillRect(tx + 14, y + 41, 12, 12);
        g.fillText(label, tx + 40, y + 56);
    }

    // press start, with a big blue arrow
    const by = box.y + box.h;
    g.fillStyle = PAPER;
    g.fillText("PRESS START", tx, by - 6);
    g.strokeStyle = BLUE;
    g.lineWidth = 12;
    g.lineCap = "square";
    const ax = tx + 250;
    const ay = by - 16;
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(W - pad - 6, ay);
    g.moveTo(W - pad - 40, ay - 34);
    g.lineTo(W - pad - 6, ay);
    g.lineTo(W - pad - 40, ay + 34);
    g.stroke();
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

export async function createArcade(o: ArcadeOptions) {
    await Promise.all([document.fonts.load(`700 40px Silkscreen`), document.fonts.load(`400 24px 'JetBrains Mono'`)]).catch(() => {});

    const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    const screen = part("Screen");
    const marquee = part("Marquee");
    // the cabinet's own glass sits in front of the screen plane: hide it, and
    // bring the plane forward of the bezel
    gltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh !== screen && (mesh.material as THREE.Material).name === "Screen") mesh.visible = false;
    });
    const facing = new THREE.Vector3().fromBufferAttribute(screen.geometry.attributes.normal as THREE.BufferAttribute, 0).normalize();
    screen.position.addScaledVector(facing, 0.02);
    marquee.material = new THREE.MeshBasicMaterial({ map: drawMarquee(), toneMapped: false });
    // where the screen is and how tall, for the camera to move in on it
    gltf.scene.updateMatrixWorld(true);
    const screenCentre = screen.getWorldPosition(new THREE.Vector3());
    const corner = (i: number) => new THREE.Vector3().fromBufferAttribute(screen.geometry.attributes.position as THREE.BufferAttribute, i);
    const screenHeight = corner(0).distanceTo(corner(3));

    // controls: everything clickable, and what it does
    type Action = "prev" | "next" | "open";
    const controls = new Map<THREE.Object3D, Action>();
    for (const side of ["L", "R"] as const) {
        for (let i = 1; i <= 6; i++) controls.set(part(`Btn_${side}${i}`), side === "L" ? "prev" : "next");
    }
    const stickL = part("Stick_L");
    const stickR = part("Stick_R");
    controls.set(stickL, "prev");
    controls.set(stickR, "next");
    controls.set(part("Btn_1P"), "open");
    controls.set(part("Btn_2P"), "open");
    controls.set(screen, "open");
    // each control gets its own materials, so it can light up on hover
    for (const obj of controls.keys()) {
        if (obj === screen) continue;
        obj.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : (mesh.material as THREE.Material).clone();
        });
    }
    // the sticks' balls in blue, like the buttons
    for (const stick of [stickL, stickR]) {
        stick.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                const std = m as THREE.MeshStandardMaterial;
                if (std.name === "Button") {
                    std.color.set(BLUE);
                    std.emissive.set(0x0a1060);
                }
            }
        });
    }
    const rest = new Map([...controls.keys()].map((obj) => [obj, obj.position.clone()]));

    // ---- the screen
    const screens = new Map<number, Promise<THREE.Texture>>();
    const screenFor = (i: number) => {
        if (!screens.has(i)) screens.set(i, drawScreen(o.games[i], o.games.length));
        return screens.get(i)!;
    };
    const thumbs = Promise.all(o.games.map(async (g) => (g.image ? loadImage(g.image) : null))).then((imgs) =>
        imgs.map((img) => (img ? dither(img, LIST.thumb.w, LIST.thumb.h, 3) : null)),
    );
    const blank = new THREE.DataTexture(new Uint8Array([14, 14, 14, 255]), 1, 1);
    blank.colorSpace = THREE.SRGBColorSpace;
    blank.needsUpdate = true;
    const uniforms = {
        uFrom: { value: blank as THREE.Texture },
        uTo: { value: blank as THREE.Texture },
        uRoll: { value: 0 },
        uTime: { value: 0 },
        uHover: { value: 0 },
        uFlat: { value: 0 },
        uTint: { value: new THREE.Color(PAPER) },
    };
    screen.material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, toneMapped: false });

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
                uniforms.uFrom.value = tex;
                uniforms.uRoll.value = 0;
            },
        });
    };
    let listMode = false;
    let current = 0;
    let token = 0;
    /** show game i (on the cabinet; up close the list stays) */
    const show = async (i: number) => {
        current = i;
        const me = ++token;
        const tex = await screenFor(i);
        if (me !== token || listMode) return;
        rollTo(tex);
        // get the next one ready
        screenFor((i + 1) % o.games.length);
    };
    let listTex: THREE.Texture | null = null;
    let listArgs: [number[], string] = [o.games.map((_, i) => i), "Select project"];
    /** the list on the screen: these games, under this heading */
    const setList = async (visible: number[], label: string) => {
        listArgs = [visible, label];
        const tex = drawList(o.games, visible, label, await thumbs);
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
    const pick = (e: MouseEvent) => {
        const r = o.canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        return controlOf(ray.intersectObjects(clickable, true)[0]?.object ?? null);
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
    };
    const press = (obj: THREE.Object3D) => {
        const home = rest.get(obj)!;
        if (obj === stickL || obj === stickR) {
            // the stick tilts the way it sends you, then springs back
            gsap.fromTo(obj.rotation, { z: obj === stickL ? 0.45 : -0.45 }, { z: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
        } else if (obj !== screen) {
            gsap.fromTo(obj.position, { y: home.y - 0.004 }, { y: home.y, duration: 0.25, ease: "power2.out" });
        }
    };
    o.canvas.addEventListener("pointermove", (e) => {
        if (listMode || view.zoom > 0) return;
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
        o.canvas.style.cursor = hit ? "pointer" : "";
    });
    o.canvas.addEventListener("pointerleave", () => {
        cursor.x = cursor.y = 0;
        unhover();
    });
    o.canvas.addEventListener("click", (e) => {
        if (listMode || view.zoom > 0) return;
        const hit = pick(e);
        if (!hit) return;
        press(hit);
        const action = controls.get(hit);
        if (action === "prev") o.onPrev();
        else if (action === "next") o.onNext();
        else o.onOpen();
    });

    /** to the list (in on the screen) or back to the cabinet; resolves when the camera gets there */
    const setMode = (mode: "arcade" | "list", animate = true) =>
        new Promise<void>((resolve) => {
            listMode = mode === "list";
            unhover();
            cursor.x = cursor.y = 0;
            token++;
            if (listMode) {
                if (listTex) rollTo(listTex, animate);
                else setList(...listArgs).then((tex) => rollTo(tex, animate));
            } else screenFor(current).then((tex) => rollTo(tex, animate));
            fit();
            gsap.killTweensOf(view);
            const zoom = listMode ? 1 : 0;
            if (!animate || o.reduceMotion) {
                view.zoom = zoom;
                placeCamera();
                resolve();
                return;
            }
            gsap.to(view, { zoom, duration: 1.2, ease: "power3.inOut", onUpdate: placeCamera, onComplete: resolve });
        });

    fit();
    new ResizeObserver(fit).observe(o.canvas);

    // ---- render only while it's on screen
    const startedAt = performance.now();
    let raf = 0;
    let visible = false;
    const frame = () => {
        raf = requestAnimationFrame(frame);
        uniforms.uTime.value = (performance.now() - startedAt) / 1000;
        if (!o.reduceMotion) {
            // a little parallax: the camera eases after the cursor (on the cabinet)
            drift.x += (cursor.x * 0.07 - drift.x) * 0.05;
            drift.y += (cursor.y * 0.04 - drift.y) * 0.05;
            placeCamera();
        }
        renderer.render(scene, camera);
    };
    const run = () => {
        const go = visible && !document.hidden;
        if (go && !raf) frame();
        else if (!go && raf) {
            cancelAnimationFrame(raf);
            raf = 0;
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
        /** measure again (the page's layout changed) */
        refit: fit,
        get visible() {
            return visible && !document.hidden;
        },
    };
}

export type Arcade = Awaited<ReturnType<typeof createArcade>>;
