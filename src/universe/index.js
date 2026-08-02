import { bootUniverseBackground } from "./runtime.js";

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootUniverseBackground, { once: true });
} else {
    bootUniverseBackground();
}
