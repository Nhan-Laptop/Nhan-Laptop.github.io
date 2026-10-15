(function () {
    "use strict";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Hero: the second line cycles through what I break.
    function setupHeroWord() {
        const word = document.getElementById("heroWord");
        if (!word || reducedMotion) return;
        const words = (word.dataset.words || "").split("|").filter(Boolean);
        if (words.length < 2) return;
        let index = 0;
        window.setInterval(() => {
            if (document.hidden) return;
            index = (index + 1) % words.length;
            word.classList.remove("is-swapping");
            void word.offsetWidth;
            word.textContent = words[index];
            word.classList.add("is-swapping");
        }, 2800);
    }

    // Widget: a tiny flag catcher.
    function setupFlagWidget() {
        const count = document.getElementById("flagCount");
        const sprite = document.getElementById("flagSprite");
        const message = document.getElementById("flagMsg");
        const capture = document.getElementById("flagCapture");
        const reset = document.getElementById("flagReset");
        if (!count || !sprite || !message || !capture || !reset) return;

        const flags = ["flag{lll_reduced}", "flag{nonce_reuse}", "flag{state_recovered}", "flag{noise_budget}", "flag{verified_not_guessed}"];
        let total = 0;
        capture.addEventListener("click", () => {
            total += 1;
            count.textContent = String(total);
            message.textContent = flags[(total - 1) % flags.length];
            sprite.classList.remove("is-pop");
            void sprite.offsetWidth;
            sprite.classList.add("is-pop");
        });
        reset.addEventListener("click", () => {
            total = 0;
            count.textContent = "0";
            message.textContent = "press capture";
        });
    }

    // Tag wall: shuffle the stickers.
    function setupWall() {
        const button = document.getElementById("wallShuffle");
        const list = document.getElementById("stickers");
        if (!button || !list) return;
        button.addEventListener("click", () => {
            const items = Array.from(list.children);
            for (let i = items.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [items[i], items[j]] = [items[j], items[i]];
            }
            items.forEach((item) => {
                item.style.setProperty("--r", `${(Math.random() * 6 - 3).toFixed(1)}deg`);
                list.appendChild(item);
            });
        });
    }

    setupHeroWord();
    setupFlagWidget();
    setupWall();
}());
