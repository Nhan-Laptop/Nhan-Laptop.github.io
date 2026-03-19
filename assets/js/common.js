(function () {
    const email = "nguyentrongnhan06cm@gmail.com";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const toast = document.getElementById("toast");

    function showToast(message) {
        if (!toast) {
            return;
        }

        toast.textContent = message;
        toast.classList.add("is-visible");
        window.clearTimeout(showToast.timer);
        showToast.timer = window.setTimeout(function () {
            toast.classList.remove("is-visible");
        }, 2200);
    }

    const copyEmailButton = document.getElementById("copyEmail");
    if (copyEmailButton) {
        copyEmailButton.addEventListener("click", function () {
            if (!navigator.clipboard || !navigator.clipboard.writeText) {
                showToast("Clipboard access is not available.");
                return;
            }

            navigator.clipboard.writeText(email)
                .then(function () {
                    showToast("Email copied to clipboard.");
                })
                .catch(function () {
                    showToast("Could not copy email.");
                });
        });
    }

    const photo = document.getElementById("profilePhoto");
    const trigger = document.getElementById("photoTrigger");
    const dialog = document.getElementById("photoDialog");
    const dialogImage = document.getElementById("dialogImage");
    const closeDialog = document.getElementById("closeDialog");

    if (photo && trigger && dialog && dialogImage && closeDialog) {
        const fallbackSvg = [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            "<defs>",
            '<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" stop-color="#57d8ff"/>',
            '<stop offset="100%" stop-color="#f3b34d"/>',
            "</linearGradient>",
            "</defs>",
            '<rect width="400" height="400" fill="#071019"/>',
            '<circle cx="200" cy="150" r="72" fill="url(#g)" opacity="0.96"/>',
            '<path d="M88 326c28-64 92-98 112-98s84 34 112 98" fill="url(#g)" opacity="0.96"/>',
            '<text x="200" y="368" text-anchor="middle" fill="#dff7ff" font-family="Arial, sans-serif" font-size="36" font-weight="700">NTN</text>',
            "</svg>"
        ].join("");

        const fallbackAvatar = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(fallbackSvg);

        function getCurrentPhotoSource() {
            return photo.currentSrc || photo.src || fallbackAvatar;
        }

        function applyFallbackAvatar() {
            if (photo.dataset.fallbackApplied === "true") {
                return;
            }

            photo.dataset.fallbackApplied = "true";
            photo.src = fallbackAvatar;
            photo.alt = "Fallback portrait for Nguyen Trong Nhan";
            dialogImage.src = fallbackAvatar;
        }

        photo.addEventListener("load", function () {
            dialogImage.src = getCurrentPhotoSource();
        });

        photo.addEventListener("error", applyFallbackAvatar);

        if (photo.complete) {
            if (photo.naturalWidth > 0) {
                dialogImage.src = getCurrentPhotoSource();
            } else {
                applyFallbackAvatar();
            }
        }

        trigger.addEventListener("click", function () {
            dialogImage.src = getCurrentPhotoSource();
            if (typeof dialog.showModal === "function") {
                dialog.showModal();
            } else {
                dialog.setAttribute("open", "open");
            }
        });

        closeDialog.addEventListener("click", function () {
            if (typeof dialog.close === "function") {
                dialog.close();
            } else {
                dialog.removeAttribute("open");
            }
        });

        dialog.addEventListener("click", function (event) {
            if (event.target !== dialog) {
                return;
            }

            if (typeof dialog.close === "function") {
                dialog.close();
            } else {
                dialog.removeAttribute("open");
            }
        });
    }

    if (reducedMotion || !("IntersectionObserver" in window)) {
        document.querySelectorAll(".reveal").forEach(function (el) {
            el.classList.add("is-visible");
        });
        return;
    }

    const observer = new IntersectionObserver(function (entries, currentObserver) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) {
                return;
            }

            entry.target.classList.add("is-visible");
            currentObserver.unobserve(entry.target);
        });
    }, {
        threshold: 0.12,
        rootMargin: "0px 0px -60px 0px"
    });

    document.querySelectorAll(".reveal").forEach(function (el) {
        observer.observe(el);
    });
}());
