/**
 * The projects arcade: a close-up of an arcade cabinet ("Arcade Invaders" by
 * tef, CC BY 4.0) in three.js whose screen flips through the projects. Each
 * project is drawn as a phosphor-green screen (its image dithered into four
 * greens, number, title, category, "press start"); changing project rolls the
 * picture up like a CRT losing vertical hold. The cabinet works: the left
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
const INK = "#15300d";
const PHOSPHOR = "#c3f23a";
// four greens for the dithered pictures, dark to light
const GREENS = [
    [21, 48, 13],
    [62, 112, 26],
    [128, 190, 44],
    [214, 255, 128],
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
        col = mix(col, vec3(0.75, 1.0, 0.45) * n, sin(uRoll * 3.14159) * 0.55);
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

/** the image, covered into w × h and dithered into the four greens, in chunky pixels */
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
            // a bit of contrast, then pick one of four greens with an ordered dither
            const v = Math.min(1, Math.max(0, (l - 0.5) * 1.25 + 0.5)) * 3;
            const level = Math.min(3, Math.floor(v + BAYER[(y % 4) * 4 + (x % 4)] - 0.5 + 0.5));
            const [r, g, b] = GREENS[Math.max(0, level)];
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
        }
    }
    s.putImageData(data, 0, 0);
    return small;
}

/** one project's screen */
async function drawScreen(game: ArcadeGame, total: number) {
    const W = 1024;
    const H = Math.round(W / SCREEN_ASPECT);
    const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const g = canvas.getContext("2d")!;
    g.fillStyle = PHOSPHOR;
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.6);
    glow.addColorStop(0, "rgba(240, 255, 190, 0.35)");
    glow.addColorStop(1, "rgba(240, 255, 190, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);

    const pad = 64;
    g.fillStyle = INK;
    g.font = "500 26px 'IBM Plex Mono', ui-monospace, monospace";
    g.textBaseline = "alphabetic";
    g.fillText(`PROJECT ${game.num} / ${String(total).padStart(2, "0")}`, pad, pad + 10);
    g.textAlign = "right";
    g.fillText(game.year, W - pad, pad + 10);
    g.textAlign = "left";
    g.fillRect(pad, pad + 30, W - pad * 2, 3);

    // the picture, dithered, on the left
    const box = { x: pad, y: pad + 64, w: 400, h: H - pad * 2 - 64 };
    const img = game.image ? await loadImage(game.image) : null;
    if (img) {
        const pixels = dither(img, box.w, box.h, 4);
        g.imageSmoothingEnabled = false;
        g.drawImage(pixels, box.x, box.y, box.w, box.h);
    } else {
        g.fillStyle = "rgba(21, 48, 13, 0.15)";
        g.fillRect(box.x, box.y, box.w, box.h);
    }
    g.fillStyle = INK;
    g.lineWidth = 5;
    g.strokeStyle = INK;
    g.strokeRect(box.x, box.y, box.w, box.h);

    // the title, as big as fits beside it
    const tx = box.x + box.w + 52;
    const tw = W - pad - tx;
    let size = 104;
    let lines: string[] = [];
    const words = game.title.toUpperCase().split(/\s+/);
    for (; size >= 40; size -= 4) {
        g.font = `800 ${size}px Inter, system-ui, sans-serif`;
        g.letterSpacing = `${-size * 0.04}px`;
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
        if (fits && lines.length * size * 0.92 <= 300) break;
    }
    let y = box.y + size * 0.82;
    for (const l of lines) {
        g.fillText(l, tx, y);
        y += size * 0.92;
    }
    g.letterSpacing = "0px";
    g.font = "500 26px 'IBM Plex Mono', ui-monospace, monospace";
    g.fillText(game.category.toUpperCase(), tx, y + 18);
    if (game.inProgress) {
        const label = "IN PROGRESS";
        const lw = g.measureText(label).width + 28;
        g.fillRect(tx, y + 44, lw, 42);
        g.fillStyle = PHOSPHOR;
        g.fillText(label, tx + 14, y + 74);
        g.fillStyle = INK;
    }

    // press start, with a big arrow
    const by = box.y + box.h;
    g.fillText("PRESS START", tx, by - 6);
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

/** the marquee: "PROJECTS" in phosphor, with a row of pixels dissolving along the bottom */
function drawMarquee() {
    const W = 1024;
    const H = Math.round(W / MARQUEE_ASPECT);
    const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#0d1a0a";
    g.fillRect(0, 0, W, H);
    // two rows of pixels at the foot: the bottom one mostly lit, the one above sparse
    const cell = 16;
    for (let row = 0; row < 2; row++) {
        const y = H - cell * (row + 1) - 6;
        for (let x = 8; x < W - 8; x += cell) {
            const r = Math.abs(Math.sin(x * 12.9898 + row * 78.233) * 43758.5453) % 1;
            if (r < (row === 0 ? 0.7 : 0.18)) {
                g.fillStyle = r < 0.25 ? PHOSPHOR : "#2f5a17";
                g.fillRect(x, y, cell - 3, cell - 3);
            }
        }
    }
    g.textAlign = "center";
    g.fillStyle = PHOSPHOR;
    g.font = "800 132px Inter, system-ui, sans-serif";
    g.letterSpacing = "-5px";
    g.shadowColor = "rgba(195, 242, 58, 0.6)";
    g.shadowBlur = 24;
    g.fillText("PROJECTS", W / 2, 200);
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
    scene.add(new THREE.AmbientLight(0x2a3a26, 0.6));
    const top = new THREE.SpotLight(0xe8ffd0, 3, 3, 0.7, 0.6);
    top.position.set(0, 1.5, 0.9);
    top.target.position.set(0, 0.6, 0);
    scene.add(top, top.target);
    // the screen's light spilling onto the cabinet (it's close: a little goes a long way)
    const spill = new THREE.PointLight(0xb6ff3a, 0.06);
    spill.position.set(0, 0.73, 0.25);
    scene.add(spill);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
    // a close-up: from the buttons up to the marquee, looking down a little
    const target = new THREE.Vector3(0, 0.75, 0.08);
    const viewDir = new THREE.Vector3(0, 0.22, 1).normalize();

    const gltf = await new GLTFLoader().loadAsync(MODEL);
    scene.add(gltf.scene);

    // the cabinet, restyled by material: dark green, pale trim, lime and purple buttons
    const palette: Record<string, THREE.MeshStandardMaterialParameters> = {
        Body: { color: 0x0f2410, roughness: 0.55, metalness: 0.05 },
        Side: { color: 0x0b1a0b, roughness: 0.55, metalness: 0.05 },
        Trim: { color: 0xd3dcc9, roughness: 0.4 },
        Button: { color: 0x8ff23f, roughness: 0.35, emissive: 0x3a7a10, emissiveIntensity: 0.4 },
        ButtonPlayer: { color: 0x9a6cff, roughness: 0.35, emissive: 0x3a1f8a, emissiveIntensity: 0.4 },
        Metal: { color: 0xb9c2b2, roughness: 0.3, metalness: 0.75 },
        Coin: { color: 0x1d231b, roughness: 0.5 },
        ScreenBack: { color: 0x020402, roughness: 0.9 },
        Screen: { color: 0x050a04, roughness: 0.9 },
        Marquee: { color: 0x0d1a0a, roughness: 0.9 },
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
    const rest = new Map([...controls.keys()].map((obj) => [obj, obj.position.clone()]));

    // ---- the screen
    const screens = new Map<number, Promise<THREE.Texture>>();
    const screenFor = (i: number) => {
        if (!screens.has(i)) screens.set(i, drawScreen(o.games[i], o.games.length));
        return screens.get(i)!;
    };
    const blank = new THREE.DataTexture(new Uint8Array([195, 242, 58, 255]), 1, 1);
    blank.colorSpace = THREE.SRGBColorSpace;
    blank.needsUpdate = true;
    const uniforms = {
        uFrom: { value: blank as THREE.Texture },
        uTo: { value: blank as THREE.Texture },
        uRoll: { value: 0 },
        uTime: { value: 0 },
        uHover: { value: 0 },
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

    // ---- size: keep the screen, marquee and controls in frame at any aspect ratio
    const home = new THREE.Vector3();
    const fit = () => {
        const { clientWidth: w, clientHeight: h } = o.canvas;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const vfov = THREE.MathUtils.degToRad(camera.fov);
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
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
