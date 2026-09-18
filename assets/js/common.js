(function () {
    "use strict";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function ensureSkipLink() {
        const main = document.querySelector("main");
        if (!main) return;

        if (!main.id) main.id = "main-content";
        if (document.querySelector(".skip-link")) return;

        const link = document.createElement("a");
        link.className = "skip-link";
        link.href = `#${main.id}`;
        link.textContent = "Skip to content";
        document.body.prepend(link);
    }

    function setupNavigation() {
        const header = document.querySelector(".site-header");
        const inner = header && header.querySelector(".header-inner");
        const nav = inner && inner.querySelector(".main-nav");
        if (!header || !inner || !nav) return;

        if (!nav.id) nav.id = "site-navigation";
        if (!nav.hasAttribute("aria-label")) nav.setAttribute("aria-label", "Primary navigation");
        nav.querySelectorAll(".is-active").forEach((link) => link.setAttribute("aria-current", "page"));

        let toggle = inner.querySelector(".nav-toggle");
        if (!toggle) {
            toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "nav-toggle";
            toggle.innerHTML = '<span class="nav-toggle-lines" aria-hidden="true"><span></span><span></span></span><span class="sr-only">Menu</span>';
            inner.insertBefore(toggle, nav);
        }

        toggle.setAttribute("aria-controls", nav.id);
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation menu");
        header.classList.add("nav-enhanced");

        function setOpen(open) {
            header.classList.toggle("is-menu-open", open);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
        }

        toggle.addEventListener("click", () => setOpen(!header.classList.contains("is-menu-open")));
        nav.addEventListener("click", (event) => {
            if (event.target.closest("a")) setOpen(false);
        });
        document.addEventListener("click", (event) => {
            if (!header.contains(event.target)) setOpen(false);
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && header.classList.contains("is-menu-open")) {
                setOpen(false);
                toggle.focus();
            }
        });

        const desktopQuery = window.matchMedia("(min-width: 781px)");
        const closeOnDesktop = (event) => {
            if (event.matches) setOpen(false);
        };
        if (desktopQuery.addEventListener) desktopQuery.addEventListener("change", closeOnDesktop);
    }

    let toastTimer = 0;
    function showToast(message) {
        let toast = document.getElementById("toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "toast";
            toast.className = "toast";
            toast.setAttribute("role", "status");
            toast.setAttribute("aria-live", "polite");
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add("is-visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
    }

    async function copyText(text, successMessage) {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            showToast("Clipboard access is not available.");
            return false;
        }

        try {
            await navigator.clipboard.writeText(text);
            showToast(successMessage);
            return true;
        } catch {
            showToast("Could not copy to the clipboard.");
            return false;
        }
    }

    function setupCopyEmail() {
        const fallbackEmail = "nguyentrongnhan06cm@gmail.com";
        document.querySelectorAll("#copyEmail, [data-copy-email]").forEach((button) => {
            button.addEventListener("click", () => {
                copyText(button.dataset.copyEmail || fallbackEmail, "Email copied to clipboard.");
            });
        });
    }

    function setupPhotoDialog() {
        const photo = document.getElementById("profilePhoto");
        const trigger = document.getElementById("photoTrigger");
        const dialog = document.getElementById("photoDialog");
        const dialogImage = document.getElementById("dialogImage");
        const closeDialog = document.getElementById("closeDialog");
        if (!photo || !trigger || !dialog || !dialogImage || !closeDialog) return;

        const fallbackSvg = [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" stop-color="#57d8ff"/><stop offset="100%" stop-color="#f3b34d"/>',
            "</linearGradient></defs>",
            '<rect width="400" height="400" fill="#071019"/>',
            '<circle cx="200" cy="150" r="72" fill="url(#g)"/>',
            '<path d="M88 326c28-64 92-98 112-98s84 34 112 98" fill="url(#g)"/>',
            '<text x="200" y="368" text-anchor="middle" fill="#dff7ff" font-family="Arial" font-size="36" font-weight="700">NTN</text>',
            "</svg>",
        ].join("");
        const fallbackAvatar = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(fallbackSvg)}`;

        function photoSource() {
            return photo.currentSrc || photo.src || fallbackAvatar;
        }

        function applyFallback() {
            if (photo.dataset.fallbackApplied === "true") return;
            photo.dataset.fallbackApplied = "true";
            photo.src = fallbackAvatar;
            photo.alt = "Fallback portrait for Nguyen Trong Nhan";
            dialogImage.src = fallbackAvatar;
        }

        function openDialog() {
            dialogImage.src = photoSource();
            if (typeof dialog.showModal === "function") dialog.showModal();
            else dialog.setAttribute("open", "open");
        }

        function close() {
            if (typeof dialog.close === "function") dialog.close();
            else dialog.removeAttribute("open");
        }

        photo.addEventListener("error", applyFallback);
        photo.addEventListener("load", () => { dialogImage.src = photoSource(); });
        if (photo.complete && photo.naturalWidth === 0) applyFallback();

        photo.tabIndex = 0;
        photo.setAttribute("role", "button");
        photo.setAttribute("aria-label", "Open profile photo preview");
        photo.addEventListener("click", openDialog);
        photo.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDialog();
            }
        });
        trigger.addEventListener("click", openDialog);
        closeDialog.addEventListener("click", close);
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) close();
        });
    }

    function setupReveal() {
        const elements = Array.from(document.querySelectorAll(".reveal"));
        if (reducedMotion || !("IntersectionObserver" in window)) {
            elements.forEach((element) => element.classList.add("is-visible"));
            return;
        }

        const observer = new IntersectionObserver((entries, currentObserver) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.remove("reveal-pending");
                entry.target.classList.add("is-visible");
                currentObserver.unobserve(entry.target);
            });
        }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

        elements.forEach((element) => {
            if (!element.classList.contains("is-visible") && element.getBoundingClientRect().top > window.innerHeight * 0.88) {
                element.classList.add("reveal-pending");
            }
            observer.observe(element);
        });
    }

    function setupReadingTools() {
        const article = document.querySelector(".article-body.markdown-content, .article-page .article-body");
        if (!article) return;

        const progress = document.createElement("div");
        progress.className = "reading-progress";
        progress.setAttribute("aria-hidden", "true");
        progress.innerHTML = "<span></span>";
        document.body.appendChild(progress);
        const progressBar = progress.firstElementChild;
        let progressTicking = false;

        function updateProgress() {
            progressTicking = false;
            const start = article.offsetTop - 90;
            const distance = Math.max(article.offsetHeight - window.innerHeight + 140, 1);
            const value = Math.max(0, Math.min((window.scrollY - start) / distance, 1));
            progressBar.style.transform = `scaleX(${value})`;
        }

        window.addEventListener("scroll", () => {
            if (progressTicking) return;
            progressTicking = true;
            window.requestAnimationFrame(updateProgress);
        }, { passive: true });
        window.addEventListener("resize", updateProgress);
        updateProgress();

        const headings = Array.from(article.querySelectorAll("h2, h3"));
        if (headings.length >= 3) {
            const used = new Set();
            headings.forEach((heading, index) => {
                if (heading.id) { used.add(heading.id); return; }
                let slug = (heading.textContent || `section-${index + 1}`)
                    .toLowerCase()
                    .normalize("NFKD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "") || `section-${index + 1}`;
                const base = slug;
                let suffix = 2;
                while (used.has(slug) || document.getElementById(slug)) slug = `${base}-${suffix++}`;
                used.add(slug);
                heading.id = slug;
            });

            const toc = document.createElement("details");
            toc.className = "panel article-toc";
            toc.innerHTML = [
                "<summary>On this page</summary>",
                '<nav aria-label="Table of contents"><ol>',
                headings.map((heading) => {
                    const link = document.createElement('a');
                    link.href = `#${heading.id}`;
                    link.textContent = heading.textContent;
                    return `<li class="toc-${heading.tagName.toLowerCase()}">${link.outerHTML}</li>`;
                }).join(""),
                "</ol></nav>",
            ].join("");
            article.parentNode.insertBefore(toc, article);
            toc.addEventListener("click", (event) => {
                if (event.target.closest("a") && window.innerWidth < 780) toc.open = false;
            });
        }

        article.querySelectorAll("pre").forEach((pre) => {
            if (pre.parentElement.classList.contains("code-block")) return;
            const wrapper = document.createElement("div");
            wrapper.className = "code-block";
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);

            const button = document.createElement("button");
            button.type = "button";
            button.className = "code-copy";
            button.textContent = "Copy";
            button.setAttribute("aria-label", "Copy code block");
            button.addEventListener("click", async () => {
                const copied = await copyText(pre.textContent, "Code copied to clipboard.");
                if (!copied) return;
                button.textContent = "Copied";
                window.setTimeout(() => { button.textContent = "Copy"; }, 1600);
            });
            wrapper.prepend(button);
        });
    }

    function setupTagExplorer() {
        const explorer = document.querySelector("[data-tag-explorer]");
        if (!explorer) return;

        const input = explorer.querySelector("[data-tag-search]");
        const filters = Array.from(explorer.querySelectorAll("[data-tag-filter]"));
        const posts = Array.from(explorer.querySelectorAll("[data-tag-post]"));
        const status = explorer.querySelector("[data-tag-status]");
        let activeTag = "all";

        function normalize(value) {
            let text = String(value || "");
            try { text = decodeURIComponent(text); } catch { /* Treat malformed escapes literally. */ }
            return text.toLowerCase().replace(/^#/, "").replace(/^tag-/, "");
        }

        function applyFilters() {
            const query = normalize(input ? input.value.trim() : "");
            let visible = 0;
            posts.forEach((post) => {
                const haystack = `${post.dataset.tags || ""} ${post.textContent}`.toLowerCase();
                const matchesTag = activeTag === "all" || normalize(post.dataset.tags).split(/\s+/).includes(activeTag);
                const matchesQuery = !query || haystack.includes(query);
                const show = matchesTag && matchesQuery;
                post.hidden = !show;
                if (show) visible += 1;
            });

            filters.forEach((filter) => {
                const selected = normalize(filter.dataset.tagFilter) === activeTag;
                filter.classList.toggle("is-active", selected);
                filter.setAttribute("aria-pressed", String(selected));
            });
            if (status) status.textContent = `${visible} ${visible === 1 ? "post" : "posts"}`;
        }

        function selectTag(tag, updateHash) {
            activeTag = normalize(tag) || "all";
            if (!filters.some((filter) => normalize(filter.dataset.tagFilter) === activeTag)) activeTag = "all";
            if (updateHash) {
                const next = activeTag === "all" ? `${location.pathname}${location.search}` : `#${activeTag}`;
                history.replaceState(null, "", next);
            }
            applyFilters();
        }

        filters.forEach((filter) => {
            filter.addEventListener("click", (event) => {
                event.preventDefault();
                selectTag(filter.dataset.tagFilter, true);
            });
        });
        if (input) input.addEventListener("input", applyFilters);
        window.addEventListener("hashchange", () => selectTag(location.hash, false));
        selectTag(location.hash || "all", false);
    }

    function setCurrentYear() {
        document.querySelectorAll("[data-current-year]").forEach((element) => {
            element.textContent = String(new Date().getFullYear());
        });
    }

    ensureSkipLink();
    setupNavigation();
    setupCopyEmail();
    setupPhotoDialog();
    setupReveal();
    setupReadingTools();
    setupTagExplorer();
    setCurrentYear();
}());
