import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createUniverseRenderer } from "./renderer.js";

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getScrollProgress() {
    const root = document.documentElement;
    const max = Math.max(root.scrollHeight - window.innerHeight, 1);

    return Math.max(0, Math.min(window.scrollY / max, 1));
}

function startHome(controller) {
    gsap.registerPlugin(ScrollTrigger);

    return ScrollTrigger.create({
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.65,
        invalidateOnRefresh: true,
        onUpdate(self) {
            controller.setProgress(self.progress);
        },
    });
}

function startCategory(controller) {
    let ticking = false;

    function update() {
        ticking = false;
        controller.setProgress(0.48 + getScrollProgress() * 0.22);
    }

    function scheduleUpdate() {
        if (ticking) {
            return;
        }

        ticking = true;
        window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });

    return {
        kill() {
            window.removeEventListener("scroll", scheduleUpdate);
        },
    };
}

export function bootUniverseBackground() {
    const body = document.body;

    if (!body.classList.contains("universe-page")) {
        return;
    }

    if (prefersReducedMotion()) {
        body.classList.add("universe-reduced-motion");
        return;
    }

    const mode = body.classList.contains("universe-home") ? "home" : "category";

    try {
        const controller = createUniverseRenderer({ mode });
        const scrollController = mode === "home"
            ? startHome(controller)
            : startCategory(controller);

        body.classList.add("has-universe-webgl");
        window.addEventListener("beforeunload", function cleanup() {
            scrollController.kill();
            controller.destroy();
        }, { once: true });
    } catch (error) {
        body.classList.add("universe-webgl-failed");
        console.warn("Universe background disabled:", error);
    }
}
