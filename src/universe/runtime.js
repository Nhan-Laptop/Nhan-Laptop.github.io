import { createUniverseRenderer } from "./renderer.js";

export function bootUniverseBackground() {
    const body = document.body;
    if (!body.classList.contains("universe-page") || body.classList.contains("has-universe-webgl")) return;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let savedPause = false;
    try { savedPause = sessionStorage.getItem("universe-paused") === "true"; } catch { /* Storage may be unavailable. */ }
    let userPaused = savedPause || motionQuery.matches;
    let controller;
    try {
        controller = createUniverseRenderer({
            mode: body.classList.contains("universe-home") ? "home" : "category",
            showcase: body.classList.contains("universe-showcase-page"),
        });
    } catch (error) {
        body.classList.add("universe-webgl-failed");
        console.warn("Using static cosmic background:", error);
        return;
    }
    body.classList.add("has-universe-webgl");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cosmic-motion-button";
    button.setAttribute("aria-label", "Pause universe animation");
    document.body.appendChild(button);

    function sync() {
        controller.setPaused(userPaused || document.hidden);
        button.textContent = userPaused ? "Play cosmos" : "Pause cosmos";
        button.setAttribute("aria-label", userPaused ? "Play universe animation" : "Pause universe animation");
        body.classList.toggle("cosmos-paused", userPaused);
    }
    function toggle() {
        userPaused = !userPaused;
        savedPause = userPaused;
        try { sessionStorage.setItem("universe-paused", String(userPaused)); } catch { /* Optional persistence. */ }
        sync();
    }
    function motionChanged() { userPaused = motionQuery.matches || savedPause; sync(); }
    function scrollChanged() {
        const distance = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        controller.setProgress(window.scrollY / distance);
    }
    button.addEventListener("click", toggle);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("universe-restored", sync);
    window.addEventListener("scroll", scrollChanged, { passive: true });
    motionQuery.addEventListener("change", motionChanged);
    scrollChanged();
    sync();
    // pagehide pauses work without preventing the browser's back/forward cache.
    function pageHide() { controller.setPaused(true); }
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("pageshow", sync);
}
