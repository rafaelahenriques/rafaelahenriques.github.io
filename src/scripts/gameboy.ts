/**
 * The home page Game Boy: a voxel Game Boy ("GAME BOY in voxel" by Dani, CC BY
 * 4.0) in three.js, with each selected project's clip on its screen. The
 * screen is a small LCD shader with a fine pixel grid, in the site's screen
 * colours: ink glass, paper pixels, one blue. Changing
 * project blanks the screen and drops the project's number and name in, like
 * the start-up logo. The buttons work: A and → next, B and ← back, Start (or
 * the screen) opens the project, Select pauses. A project without a clip gets
 * an "in progress" screen. It only renders while it's on screen.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { gsap } from "gsap";

export interface Channel {
    title: string;
    /** "01" */
    num: string;
    clip?: string;
    poster?: string;
}

export interface GameBoyOptions {
    canvas: HTMLCanvasElement;
    channels: Channel[];
    reduceMotion: boolean;
    onNext: () => void;
    onPrev: () => void;
    /** Start or the screen: open the project */
    onOpen: () => void;
    /** Select: pause or play */
    onToggle: () => void;
    /** the clip (or the in-progress screen) has played through, while it runs on its own */
    onEnded: () => void;
}

const MODEL = "/models/gameboy.glb";
const SCREEN_ASPECT = 1.1176; // the LCD, width / height (from the model)
const PICTURE_ASPECT = 640 / 572; // the clips and posters: made 10:9 for this screen, so nothing is cut off
const BASE_YAW = -0.38; // turned a little, so the side shows
const CARD_SECONDS = 7; // the in-progress screen, before moving on
const INK = "#e9e7e2"; // the pixels: paper
const LCD = "#0e0e0e"; // the unlit screen: ink
const BLUE = "#2f3dff";
const PIXEL = "Silkscreen, 'JetBrains Mono', monospace";

const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    uniform sampler2D uMap;
    uniform sampler2D uCard;
    uniform float uMapAspect;
    uniform float uScreenAspect;
    uniform float uBlank;
    uniform float uCardAlpha;
    uniform float uCardOffset;
    uniform vec3 uLcd;
    varying vec2 vUv;

    void main() {
        // glTF UVs run top-down; flip them so y points up, like the textures
        vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
        // the picture covers the screen (the clips are made to its shape)
        vec2 st = uv;
        float k = uMapAspect / uScreenAspect;
        if (k > 1.0) st.x = (st.x - 0.5) / k + 0.5; else st.y = (st.y - 0.5) * k + 0.5;
        vec3 col = texture2D(uMap, st).rgb;
        // an LCD: a fine pixel grid
        vec2 cell = fract(uv * vec2(128.0, 128.0 / uScreenAspect));
        float grid = smoothstep(0.0, 0.14, cell.x) * smoothstep(1.0, 0.86, cell.x)
                   * smoothstep(0.0, 0.14, cell.y) * smoothstep(1.0, 0.86, cell.y);
        col *= mix(0.86, 1.0, grid);
        // blank screen, and the project's number and name dropping in
        col = mix(col, uLcd * mix(0.9, 1.0, grid), uBlank);
        vec4 card = texture2D(uCard, vec2(uv.x, uv.y + uCardOffset));
        col = mix(col, card.rgb, card.a * uCardAlpha);
        // the screen sits in a recess: a soft shadow along the top and left
        float shade = smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.92, uv.y);
        col *= mix(0.78, 1.0, shade);
        // glass: a faint highlight, top left
        col += smoothstep(0.5, 0.0, distance(uv, vec2(0.22, 0.85))) * 0.05;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
    }
`;

/** a screen-coloured canvas texture, 10:9 like the screen */
function lcdCanvas(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, transparent = false) {
    const w = 640;
    const h = Math.round(w / SCREEN_ASPECT);
    const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const g = canvas.getContext("2d")!;
    if (!transparent) {
        g.fillStyle = LCD;
        g.fillRect(0, 0, w, h);
    }
    g.fillStyle = INK;
    g.textAlign = "center";
    draw(g, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

/** a project that has no clip yet */
function inProgressScreen(title: string) {
    return lcdCanvas((g, w, h) => {
        g.font = `400 28px ${PIXEL}`;
        g.fillText(title.toUpperCase(), w / 2, h * 0.3, w * 0.86);
        g.font = `700 56px ${PIXEL}`;
        g.fillText("IN PROGRESS", w / 2, h * 0.5);
        g.fillRect(w * 0.2, h * 0.58, w * 0.6, 4);
        g.fillStyle = BLUE;
        g.fillRect(w * 0.2, h * 0.58, w * 0.6 * 0.62, 22);
        g.fillStyle = INK;
        g.font = `400 26px ${PIXEL}`;
        g.fillText("PRESS START", w / 2, h * 0.82);
    });
}

/** the start-up card: number and name, and a blue pixel, on a transparent background */
function titleCard(num: string, title: string) {
    return lcdCanvas((g, w, h) => {
        g.font = `700 150px ${PIXEL}`;
        g.fillText(num, w / 2, h * 0.52);
        const n = g.measureText(num).width;
        g.fillStyle = BLUE;
        g.fillRect(w / 2 + n / 2 + 8, h * 0.52 - 26, 26, 26);
        g.fillStyle = INK;
        g.font = `400 28px ${PIXEL}`;
        g.fillText(title.toUpperCase(), w / 2, h * 0.68, w * 0.86);
    }, true);
}

/** the soft shadow under it */
function shadowTexture(): THREE.CanvasTexture {
    const s = 128;
    const canvas = Object.assign(document.createElement("canvas"), { width: s, height: s });
    const g = canvas.getContext("2d")!;
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "#fff");
    r.addColorStop(1, "#000");
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(canvas);
}

export async function createGameBoy(o: GameBoyOptions) {
    // the screen's letters are drawn into canvases: have them first
    await Promise.all([document.fonts.load(`400 28px ${PIXEL}`), document.fonts.load(`700 56px ${PIXEL}`)]).catch(() => {});
    const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    // 1.5 at most: full retina would be 1.8× the pixels for little visible gain
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(-1.5, 2.5, 3);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 50);
    const target = new THREE.Vector3(0, 0.47, 0);
    const viewDir = new THREE.Vector3(0.22, 0.2, 1).normalize();

    const gltf = await new GLTFLoader().loadAsync(MODEL);
    const device = new THREE.Group();
    device.add(gltf.scene);
    device.rotation.set(0, BASE_YAW, 0.06);
    scene.add(device);
    gltf.scene.traverse((obj) => {
        const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (mat?.isMeshStandardMaterial) {
            mat.roughness = 0.62;
            mat.metalness = 0;
        }
    });

    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.45),
        new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shadowTexture(), transparent: true, opacity: 0.32, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.07;
    scene.add(shadow);

    const part = (name: string) => gltf.scene.getObjectByName(name) as THREE.Mesh;
    const screen = part("Screen");
    const buttons = {
        a: part("Button_A"),
        b: part("Button_B"),
        start: part("Button_Start"),
        select: part("Button_Select"),
        dpad: part("Dpad"),
    };
    // each button gets its own material, so it can light up on hover
    for (const btn of Object.values(buttons)) btn.material = (btn.material as THREE.MeshStandardMaterial).clone();

    // On the dark theme its block turns light, so the Game Boy turns black. Its
    // colours come from one palette strip (shared by every part): repaint the
    // cream body near-black there, and the D-pad blacker still so it shows.
    const palette = (part("Body").material as THREE.MeshStandardMaterial).map!;
    const cream = palette.image as HTMLImageElement | ImageBitmap;
    const strip = Object.assign(document.createElement("canvas"), { width: cream.width, height: cream.height });
    const sg = strip.getContext("2d")!;
    const BLACK_GB: Record<number, string> = { 89: "#2a2a2d", 194: "#0b0b0c", 253: "#0b0b0c", 254: "#050505" };
    const paint = () => {
        sg.clearRect(0, 0, strip.width, strip.height);
        sg.drawImage(cream, 0, 0);
        if (document.documentElement.classList.contains("dark")) {
            for (const [x, color] of Object.entries(BLACK_GB)) {
                sg.fillStyle = color;
                sg.fillRect(+x, 0, 1, strip.height);
            }
        }
        palette.image = strip;
        palette.needsUpdate = true;
    };
    paint();
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const rest = new Map(Object.values(buttons).map((btn) => [btn, btn.position.z]));

    // ---- the picture
    const video = Object.assign(document.createElement("video"), { muted: true, playsInline: true, preload: "auto" });
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    const videoTex = new THREE.VideoTexture(video);
    videoTex.colorSpace = THREE.SRGBColorSpace;
    const loader = new THREE.TextureLoader();
    const posters = new Map<string, Promise<THREE.Texture>>();
    const posterTex = (url: string) => {
        if (!posters.has(url)) posters.set(url, loader.loadAsync(url).then((t) => ((t.colorSpace = THREE.SRGBColorSpace), t)));
        return posters.get(url)!;
    };
    const inProgress = new Map<number, THREE.Texture>();
    const cards = new Map<number, THREE.Texture>();

    const uniforms = {
        uMap: { value: videoTex as THREE.Texture },
        uCard: { value: null as THREE.Texture | null },
        uMapAspect: { value: PICTURE_ASPECT },
        uScreenAspect: { value: SCREEN_ASPECT },
        uBlank: { value: 1 },
        uCardAlpha: { value: 0 },
        uCardOffset: { value: 0 },
        uLcd: { value: new THREE.Color(LCD) },
    };
    screen.material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });

    // ---- channels
    let current = -1;
    let token = 0;
    let playing = !o.reduceMotion;
    let auto = !o.reduceMotion;
    let cardTimer = 0;

    /** blank the screen and drop the number and name in; resolves when it has landed */
    const boot = (i: number) => {
        if (!cards.has(i)) cards.set(i, titleCard(o.channels[i].num, o.channels[i].title));
        uniforms.uCard.value = cards.get(i)!;
        gsap.killTweensOf([uniforms.uBlank, uniforms.uCardAlpha, uniforms.uCardOffset]);
        uniforms.uBlank.value = 1;
        uniforms.uCardAlpha.value = 1;
        if (o.reduceMotion) {
            uniforms.uCardOffset.value = 0;
            return Promise.resolve();
        }
        uniforms.uCardOffset.value = -0.75;
        return new Promise<void>((resolve) =>
            gsap.to(uniforms.uCardOffset, { value: 0, duration: 0.7, ease: "steps(14)", onComplete: () => void setTimeout(resolve, 350) }),
        );
    };
    /** the picture comes up */
    const reveal = () => {
        if (o.reduceMotion) {
            uniforms.uBlank.value = 0;
            uniforms.uCardAlpha.value = 0;
            return;
        }
        gsap.to(uniforms.uBlank, { value: 0, duration: 0.3, ease: "power2.out" });
        gsap.to(uniforms.uCardAlpha, { value: 0, duration: 0.2 });
    };
    const scheduleNext = () => {
        window.clearTimeout(cardTimer);
        if (auto && playing) cardTimer = window.setTimeout(() => o.onEnded(), CARD_SECONDS * 1000);
    };

    const tune = async (i: number) => {
        const me = ++token;
        const ch = o.channels[i];
        current = i;
        window.clearTimeout(cardTimer);
        video.pause();
        const landed = boot(i);

        let picture: THREE.Texture;
        if (!ch.clip) {
            if (!inProgress.has(i)) inProgress.set(i, inProgressScreen(ch.title));
            picture = inProgress.get(i)!;
        } else if (!playing) {
            picture = await posterTex(ch.poster!);
        } else {
            video.loop = !auto;
            video.src = ch.clip;
            await new Promise<void>((resolve) => {
                const done = () => {
                    video.removeEventListener("loadeddata", done);
                    video.removeEventListener("error", done);
                    resolve();
                };
                video.addEventListener("loadeddata", done);
                video.addEventListener("error", done);
                window.setTimeout(done, 4000);
            });
            picture = videoTex;
        }
        await landed;
        if (me !== token) return;
        uniforms.uMap.value = picture;
        uniforms.uMapAspect.value = picture === videoTex || ch.clip ? PICTURE_ASPECT : SCREEN_ASPECT;
        if (picture === videoTex) video.play().catch(() => {});
        if (!ch.clip) scheduleNext();
        reveal();
    };

    video.addEventListener("ended", () => {
        if (auto) o.onEnded();
    });

    // ---- size: keep the whole Game Boy in frame at any aspect ratio
    const fit = () => {
        const { clientWidth: w, clientHeight: h } = o.canvas;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const vfov = THREE.MathUtils.degToRad(camera.fov);
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
        const d = Math.max(0.46 / Math.tan(hfov / 2), 0.62 / Math.tan(vfov / 2));
        camera.position.copy(target).addScaledVector(viewDir, d);
        camera.lookAt(target);
        camera.updateProjectionMatrix();
    };
    fit();
    new ResizeObserver(fit).observe(o.canvas);

    // ---- pointer: it leans towards the cursor; the buttons and the screen work
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const lean = { x: 0, y: 0 };
    const targets = [screen, ...Object.values(buttons)];
    let hovered: THREE.Mesh | null = null;
    const pick = (e: MouseEvent) => {
        const r = o.canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        return ray.intersectObjects(targets, false)[0] ?? null;
    };
    const glow = (mesh: THREE.Mesh | null, on: boolean) => {
        if (mesh && mesh !== screen) ((mesh.material as THREE.MeshStandardMaterial).emissive as THREE.Color).setScalar(on ? 0.14 : 0);
    };
    const press = (btn: THREE.Mesh) => {
        const z = rest.get(btn)!;
        gsap.killTweensOf(btn.position);
        gsap.fromTo(btn.position, { z: z - 0.008 }, { z, duration: 0.25, ease: "power2.out" });
    };
    o.canvas.addEventListener("pointermove", (e) => {
        const hit = pick(e);
        const mesh = (hit?.object as THREE.Mesh) ?? null;
        // it leans with the cursor, but holds still over a button, so the button stays put
        if (e.pointerType === "mouse" && !o.reduceMotion && !mesh) {
            lean.x = ndc.x;
            lean.y = ndc.y;
        }
        if (mesh !== hovered) {
            glow(hovered, false);
            glow(mesh, true);
            hovered = mesh;
        }
        o.canvas.style.cursor = mesh ? "pointer" : "";
    });
    o.canvas.addEventListener("pointerleave", () => {
        lean.x = lean.y = 0;
        glow(hovered, false);
        hovered = null;
        o.canvas.style.cursor = "";
    });
    o.canvas.addEventListener("click", (e) => {
        const hit = pick(e);
        if (!hit) return;
        const mesh = hit.object as THREE.Mesh;
        if (mesh !== screen) press(mesh);
        if (mesh === screen || mesh === buttons.start) o.onOpen();
        else if (mesh === buttons.a) o.onNext();
        else if (mesh === buttons.b) o.onPrev();
        else if (mesh === buttons.select) o.onToggle();
        else if (mesh === buttons.dpad) {
            // which arm of the cross: right and down go forward, left and up go back
            const p = buttons.dpad.worldToLocal(hit.point.clone());
            const forward = Math.abs(p.x) >= Math.abs(p.y) ? p.x > 0 : p.y < 0;
            if (forward) o.onNext();
            else o.onPrev();
        }
    });

    // ---- render only while it's on screen
    const startedAt = performance.now();
    let raf = 0;
    let visible = false;
    let started = false;
    const frame = () => {
        raf = requestAnimationFrame(frame);
        const t = (performance.now() - startedAt) / 1000;
        const k = o.reduceMotion ? 1 : 0.06;
        device.rotation.y += (BASE_YAW + lean.x * 0.2 - device.rotation.y) * k;
        device.rotation.x += (-lean.y * 0.06 - device.rotation.x) * k;
        if (!o.reduceMotion) device.position.y = Math.sin(t * 0.9) * 0.008;
        renderer.render(scene, camera);
    };
    const run = () => {
        const go = visible && !document.hidden;
        if (go && !raf) {
            frame();
            if (playing && o.channels[current]?.clip && uniforms.uMap.value === videoTex) video.play().catch(() => {});
        } else if (!go && raf) {
            cancelAnimationFrame(raf);
            raf = 0;
            video.pause();
        }
        // the first project boots once it's actually seen
        if (go && !started && current >= 0) {
            started = true;
            tune(current);
        }
    };
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        run();
    }).observe(o.canvas);
    document.addEventListener("visibilitychange", run);

    return {
        /** switch project; before it's been seen, just remember which one */
        tune(i: number) {
            current = i;
            if (started) tune(i);
            else run();
        },
        /** play the clips, or show stills */
        setPlaying(on: boolean) {
            playing = on;
            if (current >= 0 && started) tune(current);
        },
        /** while auto, a clip plays once and then it moves on */
        setAuto(on: boolean) {
            auto = on;
            video.loop = !on;
            if (!on) window.clearTimeout(cardTimer);
        },
    };
}

export type GameBoy = Awaited<ReturnType<typeof createGameBoy>>;
