import { gsap } from "/node_modules/gsap/index.js";
import { Draggable } from "/node_modules/gsap/Draggable.js";

gsap.registerPlugin(Draggable);

const group = document.querySelector(".footer-creature__group");
const body = group?.querySelector(".footer-creature__body");
const shadow = group?.querySelector(".footer-creature__shadow");
const z = group?.querySelector(".footer-creature__z");

if (group && body && shadow && z) {
    const container = group.parentElement;

    // Breathing animation
    gsap.to(body, {
        y: -3,
        scaleX: 1.04,
        scaleY: 0.98,
        duration: 2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
    });

    gsap.to(shadow, {
        scaleX: 1.12,
        opacity: 0.55,
        duration: 2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
    });

    // Z animation (dark only)
    let zTimeline = null;

    const startZLoop = () => {
        if (zTimeline) return;
        zTimeline = gsap
            .timeline({ repeat: -1, repeatDelay: 0.2 })
            .fromTo(
                z,
                { opacity: 0, y: 0, scale: 0.7 },
                {
                    opacity: 1,
                    y: -20,
                    scale: 1,
                    duration: 1.1,
                    ease: "power1.out",
                }
            )
            .to(z, {
                opacity: 0,
                y: -32,
                duration: 0.7,
                ease: "power1.in",
            });
    };

    const stopZLoop = () => {
        if (!zTimeline) return;
        zTimeline.kill();
        zTimeline = null;
        gsap.set(z, { opacity: 0, y: 0, scale: 0.7 });
    };

    const isDark = () =>
        document.documentElement.classList.contains("dark");

    const syncTheme = () => {
        if (isDark()) {
            startZLoop();
        } else {
            stopZLoop();
        }
    };

    // Initial + observe theme changes
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
    });

    // Horizontal-only drag, bounded to its container
    Draggable.create(group, {
        type: "x",
        bounds: container,
        inertia: false,
        dragResistance: 0.2,
        onPress() {
            gsap.to(body, {
                scaleY: 0.9,
                scaleX: 1.08,
                duration: 0.2,
            });
        },
        onRelease() {
            gsap.to(body, {
                scaleX: 1,
                scaleY: 1,
                duration: 0.4,
                ease: "elastic.out(1, 0.5)",
            });
        },
    });
}