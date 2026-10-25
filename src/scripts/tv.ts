/**
 * The home page TV: an old CRT ("Old TV" by Blank2574, CC BY 4.0) in three.js,
 * with each selected project's clip on its curved glass. The glass is a small
 * CRT shader: a slight bulge, scanlines, colour fringes, a vignette, static
 * between channels and a green channel number in the corner. The channel dial
 * turns with the channel and can be clicked; clicking the screen opens the
 * project. A project without a clip gets a test card. It only renders while
 * it's on screen.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { gsap } from "gsap";

export interface Channel {
    title: string;
    /** "CH 01" */
    label: string;
    clip?: string;
    poster?: string;
}

export interface TVOptions {
    canvas: HTMLCanvasElement;
    channels: Channel[];
    reduceMotion: boolean;
    /** the dial was clicked */
    onDial: () => void;
    /** the screen was clicked */
    onScreen: () => void;
    /** the clip (or the test card) has played through, while the TV runs on its own */
    onEnded: () => void;
}

const MODEL = "/models/old-tv.glb";
const SCREEN_ASPECT = 1.2535; // the glass, width / height (from the model)
const PICTURE_ASPECT = 4 / 3; // the clips, posters and test card
const DIAL_STEP = Math.PI / 6; // one click of the channel dial
const BASE_YAW = -0.32; // turned a little, so the wooden side shows
const TEST_CARD_SECONDS = 7;

const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    uniform sampler2D uMap;
    uniform sampler2D uOsd;
    uniform float uMapAspect;
    uniform float uScreenAspect;
    uniform float uTime;
    uniform float uStatic;
    uniform float uPower;
    uniform float uOsdAlpha;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
        // glTF UVs run top-down; flip them so y points up, like the textures
        vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
        vec2 c = uv - 0.5;
        // a little CRT bulge
        vec2 p = 0.5 + c * (0.94 + 0.12 * dot(c, c));
        // the 4:3 picture covers the glass
        vec2 st = p;
        float k = uMapAspect / uScreenAspect;
        if (k > 1.0) st.x = (st.x - 0.5) / k + 0.5; else st.y = (st.y - 0.5) * k + 0.5;
        // the picture tears sideways while the channel changes
        float row = floor(p.y * 180.0);
        st.x += (hash(vec2(row, floor(uTime * 24.0))) - 0.5) * 0.06 * uStatic;
        vec3 col = vec3(
            texture2D(uMap, st + vec2(0.0015, 0.0)).r,
            texture2D(uMap, st).g,
            texture2D(uMap, st - vec2(0.0015, 0.0)).b
        );
        // scanlines and a slow rolling band
        col *= 0.86 + 0.14 * sin(p.y * 900.0);
        col *= 0.97 + 0.03 * sin(p.y * 6.0 - uTime * 1.5);
        // static
        float n = hash(floor(p * vec2(360.0, 280.0)) + floor(uTime * 30.0) * 1.37);
        col = mix(col, vec3(n * 0.9), uStatic);
        // the channel number
        vec4 osd = texture2D(uOsd, p);
        col = mix(col, osd.rgb, osd.a * uOsdAlpha);
        // darker towards the rounded corners
        float d = length(c * vec2(1.0, 1.15));
        col *= smoothstep(0.82, 0.32, d) * 0.55 + 0.45;
        // switching on: a bright line that opens up into the picture
        float open = smoothstep(0.0, 1.0, uPower);
        float band = 1.0 - smoothstep(open * 0.5, open * 0.5 + 0.01, abs(uv.y - 0.5));
        col = col * band * open + vec3(1.0) * band * (1.0 - open) * step(0.001, uPower);
        // the glass: a soft highlight, top left
        col += smoothstep(0.45, 0.0, distance(uv, vec2(0.28, 0.82))) * 0.06;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
    }
`;

/** colour bars for a project that has no clip yet */
function testCard(title: string): THREE.CanvasTexture {
    const w = 640;
    const h = 480;
    const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const g = canvas.getContext("2d")!;
    const bars = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];
    bars.forEach((c, i) => {
        g.fillStyle = c;
        g.fillRect((i * w) / 7, 0, w / 7 + 1, h * 0.66);
    });
    [...bars].reverse().forEach((c, i) => {
        g.fillStyle = i % 2 ? "#131313" : c;
        g.fillRect((i * w) / 7, h * 0.66, w / 7 + 1, h * 0.08);
    });
    g.fillStyle = "#131313";
    g.fillRect(0, h * 0.74, w, h * 0.26);
    // the label
    g.fillStyle = "#131313";
    g.fillRect(w * 0.14, h * 0.27, w * 0.72, h * 0.22);
    g.fillStyle = "#f3f1ec";
    g.textAlign = "center";
    g.font = "500 22px 'IBM Plex Mono', ui-monospace, monospace";
    g.fillText(title.toUpperCase(), w / 2, h * 0.345);
    g.fillStyle = "#f6d33f";
    g.font = "800 46px Inter, system-ui, sans-serif";
    g.fillText("IN PROGRESS", w / 2, h * 0.445);
    g.fillStyle = "#8a8780";
    g.font = "500 18px 'IBM Plex Mono', ui-monospace, monospace";
    g.fillText("PLEASE STAND BY", w / 2, h * 0.88);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

/** the soft shadow under the TV */
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

export async function createTV(o: TVOptions) {
    const renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(-2, 3, 3);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 50);
    const target = new THREE.Vector3(0, 0.5, 0);
    const viewDir = new THREE.Vector3(0.35, 0.45, 4.6).normalize();

    const gltf = await new GLTFLoader().loadAsync(MODEL);
    const tv = new THREE.Group();
    tv.add(gltf.scene);
    tv.rotation.y = BASE_YAW;
    scene.add(tv);

    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.3, 1.6),
        new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shadowTexture(), transparent: true, opacity: 0.4, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    tv.add(shadow);

    const screen = gltf.scene.getObjectByName("TV_Screen") as THREE.Mesh;
    const dial = gltf.scene.getObjectByName("Knob_Channel") as THREE.Mesh;
    // the dial gets its own material, so it can light up on hover
    dial.material = (dial.material as THREE.MeshStandardMaterial).clone();
    const dialMat = dial.material as THREE.MeshStandardMaterial;

    // ---- the picture
    const video = Object.assign(document.createElement("video"), { muted: true, playsInline: true, preload: "auto" });
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    const videoTex = new THREE.VideoTexture(video);
    videoTex.colorSpace = THREE.SRGBColorSpace;
    const loader = new THREE.TextureLoader();
    const posters = new Map<string, Promise<THREE.Texture>>();
    const posterTex = (url: string) => {
        if (!posters.has(url))
            posters.set(url, loader.loadAsync(url).then((t) => ((t.colorSpace = THREE.SRGBColorSpace), t)));
        return posters.get(url)!;
    };
    const cards = new Map<number, THREE.Texture>();

    // ---- the channel number, drawn on a transparent canvas the size of the glass
    const osdCanvas = Object.assign(document.createElement("canvas"), { width: 512, height: Math.round(512 / SCREEN_ASPECT) });
    const osdTex = new THREE.CanvasTexture(osdCanvas);
    osdTex.colorSpace = THREE.SRGBColorSpace;
    const drawOsd = (text: string) => {
        const g = osdCanvas.getContext("2d")!;
        g.clearRect(0, 0, osdCanvas.width, osdCanvas.height);
        g.font = "500 44px 'IBM Plex Mono', ui-monospace, monospace";
        // a dark edge first, so it reads on a white picture too
        g.lineJoin = "round";
        g.lineWidth = 8;
        g.strokeStyle = "rgba(0, 0, 0, 0.6)";
        g.strokeText(text, 54, 78);
        g.fillStyle = "#6dff8f";
        g.shadowColor = "rgba(40, 255, 110, 0.8)";
        g.shadowBlur = 12;
        g.fillText(text, 54, 78);
        osdTex.needsUpdate = true;
    };

    const uniforms = {
        uMap: { value: videoTex as THREE.Texture },
        uOsd: { value: osdTex },
        uMapAspect: { value: PICTURE_ASPECT },
        uScreenAspect: { value: SCREEN_ASPECT },
        uTime: { value: 0 },
        uStatic: { value: 1 },
        uPower: { value: 0 },
        uOsdAlpha: { value: 0 },
    };
    screen.material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });

    // ---- channels
    let current = -1;
    let token = 0;
    let playing = !o.reduceMotion;
    let auto = !o.reduceMotion;
    let cardTimer = 0;

    const showOsd = (text: string) => {
        drawOsd(text);
        gsap.killTweensOf(uniforms.uOsdAlpha);
        uniforms.uOsdAlpha.value = 1;
        gsap.to(uniforms.uOsdAlpha, { value: 0, duration: 0.4, delay: o.reduceMotion ? 1.2 : 2 });
    };
    const settle = () => {
        if (o.reduceMotion) uniforms.uStatic.value = 0;
        else gsap.to(uniforms.uStatic, { value: 0, duration: 0.35, ease: "power2.out", overwrite: true });
    };
    const scheduleCard = () => {
        window.clearTimeout(cardTimer);
        if (auto && playing) cardTimer = window.setTimeout(() => o.onEnded(), TEST_CARD_SECONDS * 1000);
    };

    const tune = async (i: number) => {
        const me = ++token;
        const ch = o.channels[i];
        const step = current < 0 ? 0 : i - current;
        current = i;
        window.clearTimeout(cardTimer);
        video.pause();
        if (o.reduceMotion) dial.rotation.z = -i * DIAL_STEP;
        else {
            gsap.to(dial.rotation, { z: -i * DIAL_STEP, duration: 0.55, ease: "back.out(2.2)" });
            // static until the new picture is ready
            if (step !== 0) {
                gsap.killTweensOf(uniforms.uStatic);
                uniforms.uStatic.value = 1;
            }
        }
        showOsd(ch.label);

        if (!ch.clip) {
            if (!cards.has(i)) cards.set(i, testCard(ch.title));
            uniforms.uMap.value = cards.get(i)!;
            settle();
            scheduleCard();
            return;
        }
        if (!playing) {
            // a still: the poster
            const tex = await posterTex(ch.poster!);
            if (me !== token) return;
            uniforms.uMap.value = tex;
            settle();
            return;
        }
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
        if (me !== token) return;
        uniforms.uMap.value = videoTex;
        video.play().catch(() => {});
        settle();
    };

    video.addEventListener("ended", () => {
        if (auto) o.onEnded();
    });

    // ---- size: keep the whole TV in frame at any aspect ratio
    const fit = () => {
        const { clientWidth: w, clientHeight: h } = o.canvas;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const vfov = THREE.MathUtils.degToRad(camera.fov);
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
        const d = Math.max(1.0 / Math.tan(hfov / 2), 0.72 / Math.tan(vfov / 2));
        camera.position.copy(target).addScaledVector(viewDir, d);
        camera.lookAt(target);
        camera.updateProjectionMatrix();
    };
    fit();
    new ResizeObserver(fit).observe(o.canvas);

    // ---- pointer: the TV leans towards it; the dial and the screen are clickable
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const lean = { x: 0, y: 0 };
    let hovering: "dial" | "screen" | null = null;
    const pick = (e: PointerEvent) => {
        const r = o.canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects([dial, screen], false)[0]?.object;
        return hit === dial ? "dial" : hit === screen ? "screen" : null;
    };
    o.canvas.addEventListener("pointermove", (e) => {
        hovering = pick(e);
        if (e.pointerType === "mouse" && !o.reduceMotion) {
            lean.x = ndc.x;
            lean.y = ndc.y;
        }
        o.canvas.style.cursor = hovering ? "pointer" : "";
        dialMat.emissive.setScalar(hovering === "dial" ? 0.12 : 0);
    });
    o.canvas.addEventListener("pointerleave", () => {
        lean.x = lean.y = 0;
        hovering = null;
        o.canvas.style.cursor = "";
        dialMat.emissive.setScalar(0);
    });
    o.canvas.addEventListener("click", (e) => {
        const hit = pick(e as PointerEvent);
        if (hit === "dial") o.onDial();
        else if (hit === "screen") o.onScreen();
    });

    // ---- render only while it's on screen
    const startedAt = performance.now();
    let raf = 0;
    let visible = false;
    let poweredOn = false;
    const frame = () => {
        raf = requestAnimationFrame(frame);
        const t = (performance.now() - startedAt) / 1000;
        uniforms.uTime.value = t;
        const k = o.reduceMotion ? 1 : 0.06;
        tv.rotation.y += (BASE_YAW + lean.x * 0.22 - tv.rotation.y) * k;
        tv.rotation.x += (-lean.y * 0.05 - tv.rotation.x) * k;
        if (!o.reduceMotion) tv.position.y = Math.sin(t * 0.9) * 0.006;
        renderer.render(scene, camera);
    };
    const run = () => {
        const go = visible && !document.hidden;
        if (go && !raf) {
            frame();
            if (playing && o.channels[current]?.clip) video.play().catch(() => {});
        } else if (!go && raf) {
            cancelAnimationFrame(raf);
            raf = 0;
            video.pause();
        }
        if (go && !poweredOn) {
            poweredOn = true;
            if (o.reduceMotion) uniforms.uPower.value = 1;
            else gsap.to(uniforms.uPower, { value: 1, duration: 0.7, ease: "power2.out", delay: 0.15 });
        }
    };
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        run();
    }).observe(o.canvas);
    document.addEventListener("visibilitychange", run);

    return {
        tune,
        /** play the clips, or show stills */
        setPlaying(on: boolean) {
            playing = on;
            if (current >= 0) tune(current);
        },
        /** while auto, a clip plays once and then the TV moves on */
        setAuto(on: boolean) {
            auto = on;
            video.loop = !on;
            if (!on) window.clearTimeout(cardTimer);
        },
    };
}

export type TV = Awaited<ReturnType<typeof createTV>>;
