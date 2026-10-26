/**
 * The projects arcade: a close-up of an arcade cabinet ("Arcade Invaders" by
 * tef, CC BY 4.0) in three.js whose screen flips through the projects. Each
 * project is drawn as a dark screen in neon (its image dithered into four
 * tones of it, its title in pixel letters, number, category, "press start");
 * changing project rolls the picture up like a CRT losing vertical hold. The cabinet works: the left
 * stick and buttons go back, the right ones forward, 1P / 2P and the screen
 * open the project. Until the visitor touches it, it flips on its own. It only
 * renders while it's on screen.
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
}

const MODEL = "/models/arcade.glb";
const SCREEN_ASPECT = 1.4172; // the screen, width / height (from the model)
const MARQUEE_ASPECT = 3.3408;
// how much has to stay in view around the screen, half width / half height
const FRAME = { x: 0.2, y: 0.23 };
// a black cabinet lit in one neon colour (light blue; for pink: 255, 46, 136 with
// #6e0f3f, #ffc2dd, #0f0a10 and pink tones), with yellow sticks and red buttons
const NEON_RGB = "92, 200, 255";
const NEON = `rgb(${NEON_RGB})`;
const neon = (alpha: number) => `rgba(${NEON_RGB}, ${alpha})`;
const NEON_DEEP = "#0d3a57";
const NEON_PALE = "#cdeeff";
const YELLOW = "#ffd23f";
const SCREEN_BG = "#080d12";
const WHITE = "#f1f6f9";
// four tones of it for the dithered pictures, dark to light
const TONES = [
    [8, 13, 18],
    [18, 64, 98],
    [64, 178, 240],
    [206, 240, 255],
];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

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
        vec2 p = 0.5 + c * (0.95 + 0.1 * dot(c, c));
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

/** the image, covered into w × h and dithered into the four tones, in chunky pixels */
function dither(img: HTMLImageElement, w: number, h: number, px: number) {
    const cw = Math.ceil(w / px);
    const ch = Math.ceil(h / px);
    const small = Object.assign(document.createElement("canvas"), { width: cw, height: ch });
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

/**
 * Text in big square pixels, like an arcade font: drawn tiny (one canvas pixel
 * per cell), kept solid, for drawing scaled up without smoothing.
 */
function pixelText(lines: string[], size: number, color: string) {
    const font = `800 ${size}px Inter, system-ui, sans-serif`;
    const m = document.createElement("canvas").getContext("2d")!;
    m.font = font;
    m.letterSpacing = "1px";
    const w = Math.ceil(Math.max(...lines.map((l) => m.measureText(l).width))) + 2;
    const lineH = Math.round(size * 0.95);
    const small = Object.assign(document.createElement("canvas"), { width: w, height: lineH * lines.length + 2 });
    const s = small.getContext("2d", { willReadFrequently: true })!;
    s.font = font;
    s.letterSpacing = "1px";
    s.textBaseline = "top";
    s.fillStyle = color;
    lines.forEach((l, i) => s.fillText(l, 1, 1 + i * lineH - size * 0.08));
    // every cell either on or off
    const data = s.getImageData(0, 0, small.width, small.height);
    for (let i = 3; i < data.data.length; i += 4) data.data[i] = data.data[i] > 100 ? 255 : 0;
    s.putImageData(data, 0, 0);
    return small;
}

/** pixel text, scaled up cell by cell, with a deeper copy one cell down-right for depth */
function drawPixelText(g: CanvasRenderingContext2D, lines: string[], size: number, cell: number, x: number, y: number, glow = 0) {
    g.imageSmoothingEnabled = false;
    const back = pixelText(lines, size, NEON_DEEP);
    const front = pixelText(lines, size, NEON);
    g.drawImage(back, x + cell, y + cell, back.width * cell, back.height * cell);
    g.save();
    if (glow) {
        g.shadowColor = neon(0.7);
        g.shadowBlur = glow;
    }
    g.drawImage(front, x, y, front.width * cell, front.height * cell);
    g.restore();
    return { w: front.width * cell, h: front.height * cell };
}

/** one project's screen */
async function drawScreen(game: ArcadeGame, total: number) {
    const W = 1024;
    const H = Math.round(W / SCREEN_ASPECT);
    const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const g = canvas.getContext("2d")!;
    g.fillStyle = SCREEN_BG;
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.6);
    glow.addColorStop(0, neon(0.16));
    glow.addColorStop(1, neon(0));
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);

    const pad = 64;
    g.fillStyle = NEON_PALE;
    g.font = "500 26px 'IBM Plex Mono', ui-monospace, monospace";
    g.textBaseline = "alphabetic";
    g.fillText(`PROJECT ${game.num} / ${String(total).padStart(2, "0")}`, pad, pad + 10);
    g.textAlign = "right";
    g.fillText(game.year, W - pad, pad + 10);
    g.textAlign = "left";
    g.fillStyle = NEON;
    g.fillRect(pad, pad + 30, W - pad * 2, 3);

    // the picture, dithered, on the left
    const box = { x: pad, y: pad + 64, w: 400, h: H - pad * 2 - 64 };
    const img = game.image ? await loadImage(game.image) : null;
    if (img) {
        const pixels = dither(img, box.w, box.h, 4);
        g.imageSmoothingEnabled = false;
        g.drawImage(pixels, box.x, box.y, box.w, box.h);
    } else {
        g.fillStyle = neon(0.12);
        g.fillRect(box.x, box.y, box.w, box.h);
    }
    g.lineWidth = 5;
    g.strokeStyle = NEON;
    g.strokeRect(box.x, box.y, box.w, box.h);

    // the title in pixel letters, as big as fits beside it
    const tx = box.x + box.w + 52;
    const tw = W - pad - tx;
    const cell = 5;
    const words = game.title.toUpperCase().split(/\s+/);
    const m = document.createElement("canvas").getContext("2d")!;
    m.letterSpacing = "1px";
    let size = 26;
    let lines: string[] = [];
    for (; size >= 7; size--) {
        m.font = `800 ${size}px Inter, system-ui, sans-serif`;
        lines = [];
        let line = "";
        for (const word of words) {
            const tryLine = line ? `${line} ${word}` : word;
            if (m.measureText(tryLine).width * cell <= tw) line = tryLine;
            else {
                if (line) lines.push(line);
                line = word;
            }
        }
        if (line) lines.push(line);
        const fits = lines.every((l) => m.measureText(l).width * cell <= tw);
        if (fits && lines.length * size * 0.95 * cell <= 300) break;
    }
    const title = drawPixelText(g, lines, size, cell, tx, box.y);
    let y = box.y + title.h + 34;
    g.fillStyle = NEON_PALE;
    g.font = "500 26px 'IBM Plex Mono', ui-monospace, monospace";
    g.fillText(game.category.toUpperCase(), tx, y);
    if (game.inProgress) {
        const label = "IN PROGRESS";
        const lw = g.measureText(label).width + 28;
        g.fillStyle = YELLOW;
        g.fillRect(tx, y + 26, lw, 42);
        g.fillStyle = SCREEN_BG;
        g.fillText(label, tx + 14, y + 56);
    }

    // press start, with a big arrow
    const by = box.y + box.h;
    g.fillStyle = WHITE;
    g.shadowColor = "rgba(255, 255, 255, 0.6)";
    g.shadowBlur = 10;
    g.fillText("PRESS START", tx, by - 6);
    g.shadowBlur = 0;
    g.strokeStyle = NEON;
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

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

/** the marquee: "PROJECTS" in pixel letters in a neon frame, with a yellow star either side */
function drawMarquee() {
    const W = 1024;
    const H = Math.round(W / MARQUEE_ASPECT);
    const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#070608";
    g.fillRect(0, 0, W, H);
    // (the top of the texture sits behind the cabinet's lip, so the frame starts lower)
    const frame = { x: 28, y: 84, w: W - 56, h: H - 84 - 16 };
    g.save();
    g.shadowColor = neon(0.8);
    g.shadowBlur = 18;
    g.strokeStyle = NEON;
    g.lineWidth = 7;
    g.strokeRect(frame.x, frame.y, frame.w, frame.h);
    g.restore();
    g.strokeStyle = YELLOW;
    g.lineWidth = 2;
    g.strokeRect(frame.x + 14, frame.y + 14, frame.w - 28, frame.h - 28);

    const cell = 8;
    const text = pixelText(["PROJECTS"], 13, NEON);
    const tw = text.width * cell;
    const th = text.height * cell;
    const cy = frame.y + frame.h / 2;
    drawPixelText(g, ["PROJECTS"], 13, cell, (W - tw) / 2, cy - th / 2, 22);

    // a pixel star each side
    const STAR = ["..#..", ".###.", "#####", ".###.", "#.#.#"];
    g.fillStyle = YELLOW;
    for (const sx of [(W - tw) / 2 - 110, (W + tw) / 2 + 70]) {
        STAR.forEach((row, r) => [...row].forEach((c, k) => c === "#" && g.fillRect(sx + k * cell, cy - 20 + r * cell, cell, cell)));
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false; // glTF UVs run top-down
    return tex;
}

export async function createArcade(o: ArcadeOptions) {
    await Promise.all([document.fonts.load("800 64px Inter"), document.fonts.load("500 24px 'IBM Plex Mono'")]).catch(() => {});

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
    const spill = new THREE.PointLight(NEON, 0.06);
    spill.position.set(0, 0.73, 0.25);
    scene.add(spill);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
    // a close-up: from the buttons up to the marquee, looking down a little
    const target = new THREE.Vector3(0, 0.75, 0.08);
    const viewDir = new THREE.Vector3(0, 0.22, 1).normalize();

    const gltf = await new GLTFLoader().loadAsync(MODEL);
    scene.add(gltf.scene);

    // the cabinet, restyled by material: black, with neon trim and red buttons
    const palette: Record<string, THREE.MeshStandardMaterialParameters> = {
        Body: { color: 0x0e0d10, roughness: 0.5, metalness: 0.1 },
        Side: { color: 0x121114, roughness: 0.5, metalness: 0.1 },
        Trim: { color: NEON, roughness: 0.4, emissive: NEON, emissiveIntensity: 0.55 },
        Button: { color: 0xf0245c, roughness: 0.35, emissive: 0x5a0a22, emissiveIntensity: 0.4 },
        ButtonPlayer: { color: YELLOW, roughness: 0.35 },
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
    const facing = new THREE.Vector3().fromBufferAttribute(screen.geometry.attributes.normal as THREE.BufferAttribute, 0);
    screen.position.addScaledVector(facing, 0.02);
    marquee.material = new THREE.MeshBasicMaterial({ map: drawMarquee(), toneMapped: false });

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
    // the sticks' balls in yellow, like the reference's joystick
    for (const stick of [stickL, stickR]) {
        stick.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                const std = m as THREE.MeshStandardMaterial;
                if (std.name === "Button") {
                    std.color.set(YELLOW);
                    std.emissive.set(0x4a3600);
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
    const blank = new THREE.DataTexture(new Uint8Array([8, 13, 18, 255]), 1, 1);
    blank.colorSpace = THREE.SRGBColorSpace;
    blank.needsUpdate = true;
    const uniforms = {
        uFrom: { value: blank as THREE.Texture },
        uTo: { value: blank as THREE.Texture },
        uRoll: { value: 0 },
        uTime: { value: 0 },
        uHover: { value: 0 },
        uTint: { value: new THREE.Color(NEON_PALE) },
    };
    screen.material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, toneMapped: false });

    let current = -1;
    let token = 0;
    /** show game i: the picture rolls over to it */
    const show = async (i: number) => {
        const me = ++token;
        const tex = await screenFor(i);
        if (me !== token) return;
        // finish a roll in progress first
        gsap.killTweensOf(uniforms.uRoll);
        if (uniforms.uRoll.value > 0) uniforms.uFrom.value = uniforms.uTo.value;
        uniforms.uRoll.value = 0;
        uniforms.uTo.value = tex;
        current = i;
        if (o.reduceMotion || uniforms.uFrom.value === blank) {
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
        // get the neighbours ready
        screenFor((i + 1) % o.games.length);
    };

    // ---- size: keep the screen, marquee and controls in frame at any aspect ratio.
    // The page can move the cabinet off-centre to the right (CSS --view-shift,
    // a fraction of the width), to leave room for text on the left.
    const home = new THREE.Vector3();
    const fit = () => {
        const { clientWidth: w, clientHeight: h } = o.canvas;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const shift = parseFloat(getComputedStyle(o.canvas).getPropertyValue("--view-shift")) || 0;
        if (shift) camera.setViewOffset(w, h, -shift * w, 0, w, h);
        else camera.clearViewOffset();
        const vfov = THREE.MathUtils.degToRad(camera.fov);
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect * (1 - 2 * shift));
        const d = Math.max(FRAME.x / Math.tan(hfov / 2), FRAME.y / Math.tan(vfov / 2));
        home.copy(target).addScaledVector(viewDir, d);
        camera.position.copy(home);
        camera.lookAt(target);
        camera.updateProjectionMatrix();
    };
    fit();
    new ResizeObserver(fit).observe(o.canvas);

    // ---- pointer
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const look = { x: 0, y: 0 };
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
    const animate = (obj: THREE.Object3D) => {
        const home = rest.get(obj)!;
        if (obj === stickL || obj === stickR) {
            // the stick tilts the way it sends you, then springs back
            gsap.fromTo(obj.rotation, { z: obj === stickL ? 0.45 : -0.45 }, { z: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
        } else if (obj !== screen) {
            gsap.fromTo(obj.position, { y: home.y - 0.004 }, { y: home.y, duration: 0.25, ease: "power2.out" });
        }
    };
    o.canvas.addEventListener("pointermove", (e) => {
        const hit = pick(e);
        // the view drifts with the cursor, but holds still over a control
        if (e.pointerType === "mouse" && !o.reduceMotion && !hit) {
            look.x = ndc.x;
            look.y = ndc.y;
        }
        if (hit !== hovered) {
            glow(hovered, false);
            glow(hit, true);
            hovered = hit;
        }
        o.canvas.style.cursor = hit ? "pointer" : "";
    });
    o.canvas.addEventListener("pointerleave", () => {
        look.x = look.y = 0;
        glow(hovered, false);
        hovered = null;
        o.canvas.style.cursor = "";
    });
    o.canvas.addEventListener("click", (e) => {
        const hit = pick(e);
        if (!hit) return;
        animate(hit);
        const action = controls.get(hit);
        if (action === "prev") o.onPrev();
        else if (action === "next") o.onNext();
        else o.onOpen();
    });

    // ---- render only while it's on screen
    const startedAt = performance.now();
    const drift = new THREE.Vector2();
    let raf = 0;
    let visible = false;
    const frame = () => {
        raf = requestAnimationFrame(frame);
        uniforms.uTime.value = (performance.now() - startedAt) / 1000;
        if (!o.reduceMotion) {
            // a little parallax: the camera eases after the cursor, around the screen
            drift.x += (look.x * 0.07 - drift.x) * 0.05;
            drift.y += (look.y * 0.04 - drift.y) * 0.05;
            camera.position.set(home.x + drift.x, home.y + drift.y, home.z);
            camera.lookAt(target);
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
        get current() {
            return current;
        },
        get visible() {
            return visible && !document.hidden;
        },
    };
}

export type Arcade = Awaited<ReturnType<typeof createArcade>>;
