const fs = require("fs/promises");
const path = require("path");
const { marked } = require("marked");
const { markedHighlight } = require("marked-highlight");
const hljs = require("highlight.js");
const katex = require("katex");

const katexExtModule = require("marked-katex-extension");
const katexExtFactory =
    typeof katexExtModule === "function"
        ? katexExtModule
        : katexExtModule.markedKatex || katexExtModule.default;

if (!katexExtFactory) {
    throw new Error("Cannot load marked-katex-extension factory");
}

const ROOT = __dirname;
const PATHS = {
    postsDir: path.join(ROOT, "posts"),
    templateHtml: path.join(ROOT, "templates", "writeup-template.html"),
    categoryTemplateHtml: path.join(ROOT, "templates", "category-template.html"),
    categoryWriteupHtml: path.join(ROOT, "categories", "writeup.html"),
    vendorHighlightDir: path.join(ROOT, "assets", "vendor", "highlight"),
    vendorKatexDir: path.join(ROOT, "assets", "vendor", "katex"),
};

function escapeHtml(text = "") {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDate(dateLike) {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) {
        return new Date().toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
}

function parseYamlScalar(value = "") {
    const trimmed = String(value).trim();
    if (
        trimmed.length >= 2 &&
        ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'")))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function parseFrontmatter(markdown) {
    const match = markdown.match(/^\s*---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
    if (!match) {
        return { found: false, date: "", tags: [], summary: "" };
    }

    const metadata = { found: true, date: "", tags: [], summary: "" };
    let currentKey = "";

    for (const line of match[1].split("\n")) {
        const keyMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
        if (keyMatch) {
            currentKey = keyMatch[1].toLowerCase();
            const value = parseYamlScalar(keyMatch[2]);

            if (currentKey === "date") metadata.date = value;
            if (currentKey === "summary") metadata.summary = value;
            if (currentKey === "tags" && /^\[.*\]$/.test(value)) {
                metadata.tags = value
                    .slice(1, -1)
                    .split(",")
                    .map(parseYamlScalar)
                    .filter(Boolean);
            }
            continue;
        }

        const listItemMatch = line.match(/^\s*-\s*(.+)$/);
        if (currentKey === "tags" && listItemMatch) {
            metadata.tags.push(parseYamlScalar(listItemMatch[1]));
        }
    }

    return metadata;
}

function parseMarkdownMetadata(markdown) {
    const frontmatter = parseFrontmatter(markdown);
    const dateMatch = markdown.match(/^\s*(?:\*\*)?Date:\s*(?:\*\*)?(.+)$/im);
    const tagsMatch = markdown.match(/^\s*(?:\*\*)?Tags:\s*(?:\*\*)?(.+)$/im);
    const summaryMatch = markdown.match(/^\s*(?:\*\*)?Summary:\s*(?:\*\*)?(.+)$/im);

    const rawDate = frontmatter.date || (dateMatch ? dateMatch[1].trim() : "");
    const dateIsoMatch = rawDate.match(/\b(20\d{2}-\d{2}-\d{2})\b/);

    const rawTags = tagsMatch ? tagsMatch[1].trim() : "";
    const frontmatterTags = frontmatter.tags.map((tag) =>
        tag.startsWith("#") ? tag : `#${tag}`
    );
    const tags = Array.from(
        new Set(frontmatterTags.length > 0 ? frontmatterTags : rawTags.match(/#[A-Za-z0-9_-]+/g) || [])
    );

    const summary = frontmatter.summary || (summaryMatch ? summaryMatch[1].trim() : "");

    return {
        date: dateIsoMatch ? dateIsoMatch[1] : "",
        tags,
        summary,
        hasFrontmatter: frontmatter.found,
    };
}

function stripMetadataLines(markdown) {
    return markdown
        .replace(/^\s*---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, "")
        .replace(/^\s*(?:\*\*)?Date:\s*(?:\*\*)?.*\n?/gim, "")
        .replace(/^\s*(?:\*\*)?Tags:\s*(?:\*\*)?.*\n?/gim, "")
        .replace(/^\s*(?:\*\*)?Summary:\s*(?:\*\*)?.*\n?/gim, "")
        .replace(/\n{3,}/g, "\n\n");
}

function extractDescription(markdown) {
    const noCodeBlocks = markdown.replace(/```[\s\S]*?```/g, " ");
    const noDetails = noCodeBlocks
        .replace(/<details>[\s\S]*?<\/details>/gi, " ")
        .replace(/<summary>[\s\S]*?<\/summary>/gi, " ");

    const lines = noDetails.split("\n");
    const paragraph = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            if (paragraph.length > 0) break;
            continue;
        }

        if (
            /^#/.test(trimmed) ||
            /^>/.test(trimmed) ||
            /^\*\*Tags:/i.test(trimmed) ||
            /^Tags:/i.test(trimmed) ||
            /^!\[/.test(trimmed) ||
            /^\$\$/.test(trimmed) ||
            /^[-*+]\s+/.test(trimmed) ||
            /^\d+\.\s+/.test(trimmed) ||
            /^`/.test(trimmed)
        ) {
            continue;
        }

        paragraph.push(trimmed);
        if (paragraph.join(" ").length >= 180) break;
    }

    const description = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (!description) return "Writeup with analysis, exploit strategy, and verification steps.";

    return description.length > 220 ? `${description.slice(0, 217)}...` : description;
}

function extractDate(markdown, fallbackDate) {
    const metadata = parseMarkdownMetadata(markdown);
    if (metadata.date) return metadata.date;

    const firstIsoDate = markdown.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (firstIsoDate) return firstIsoDate[1];

    return fallbackDate;
}

function extractPostMetadata(markdown, outputFileName, fallbackDate) {
    const titleMatch = markdown.match(/^#\s+(.*)$/m);
    const title = titleMatch ? titleMatch[1].trim() : outputFileName.replace(/\.html$/, "");
    const metadata = parseMarkdownMetadata(markdown);
    const normalizedDate = metadata.date || extractDate(markdown, fallbackDate);

    return {
        title,
        date: normalizedDate,
        tags: metadata.tags,
        summary: metadata.summary || "",
        link: `../posts/${outputFileName}`,
        sourceFile: outputFileName,
    };
}

function renderCategoryPostItem(post) {
    const tagsHtml = (post.tags || [])
        .map(tag => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join(" ");

    return [
        "                <li class=\"post-item\">",
        `                    <h3><a href=\"${escapeHtml(post.link)}\">[Writeup] ${escapeHtml(post.title)}</a></h3>`,
        "                    <div class=\"post-meta\">",
        `                        <span>${escapeHtml(post.date)}</span>`,
        "                    </div>",
        tagsHtml ? `                    <div class=\"post-tags\">${tagsHtml}</div>` : "",
        "                    <p>",
        `                        ${escapeHtml(post.summary)}`,
        "                    </p>",
        "                </li>",
    ]
        .filter(Boolean)
        .join("\n");
}

async function generateWriteupCategoryPage(allPosts) {
    let categoryTemplate;
    try {
        categoryTemplate = await fs.readFile(PATHS.categoryTemplateHtml, "utf8");
    } catch {
        // Backward-compatible fallback: if category template does not exist yet,
        // reuse current category page as the layout template.
        categoryTemplate = await fs.readFile(PATHS.categoryWriteupHtml, "utf8");
    }

    const writeupPosts = allPosts.filter((post) => /^writeup-/i.test(post.sourceFile || ""));

    const sortedPosts = [...(writeupPosts.length > 0 ? writeupPosts : allPosts)].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const postsHtml = sortedPosts.map(renderCategoryPostItem).join("\n");

    const postListBlock = [
        "            <ul class=\"post-list\">",
        postsHtml,
        "            </ul>",
    ].join("\n");

    let output = categoryTemplate;

    if (output.includes("{{POST_LIST}}")) {
        output = output.replace(/{{POST_LIST}}/g, postsHtml);
    } else if (/<ul\s+class=["']post-list["'][^>]*>[\s\S]*?<\/ul>/i.test(output)) {
        output = output.replace(/<ul\s+class=["']post-list["'][^>]*>[\s\S]*?<\/ul>/i, postListBlock);
    } else {
        output = output.replace(/<\/main>/i, `\n${postListBlock}\n    </main>`);
    }

    await fs.writeFile(PATHS.categoryWriteupHtml, output, "utf8");
    console.log(`✅ Đã cập nhật trang category: ${path.relative(ROOT, PATHS.categoryWriteupHtml)}`);
}

function preprocessHackmdMarkdown(input) {
    let text = input.replace(/\r\n/g, "\n");

    // 1) Remove HackMD language suffix
    text = text.replace(/^```([A-Za-z0-9_+\-]+)!\s*$/gm, "```$1");

    // 2) Convert :::spoiler to <details>
    text = text.replace(/:::spoiler(?:\s+([^\n]+))?\n([\s\S]*?)\n:::/g, (_, title, body) => {
        const safeTitle = (title || "Bấm để xem chi tiết").trim();
        return `<details>\n<summary>${safeTitle}</summary>\n\n${body}\n\n</details>`;
    });

    // 3) Normalize inline LaTeX delimiters and wrap bare LaTeX block lines
    const lines = text.split("\n");
    const out = [];
    let inCodeFence = false;
    let inMathFence = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (/^```/.test(trimmed)) {
            inCodeFence = !inCodeFence;
            out.push(line);
            continue;
        }

        if (inCodeFence) {
            out.push(line);
            continue;
        }

        if (/^\$\$$/.test(trimmed)) {
            inMathFence = !inMathFence;
            out.push(line);
            continue;
        }

        if (inMathFence) {
            out.push(line);
            continue;
        }

        let normalizedInlineMath = line.replace(/\\\((.+?)\\\)/g, (_, expr) => `$${expr}$`);
        normalizedInlineMath = normalizedInlineMath.replace(
            /\\begin\{([A-Za-z*]+)\}(.+?)\\end\{\1\}/g,
            (_, env, body) => `$\\begin{${env}}${body}\\end{${env}}$`
        );
        const normalizedTrimmed = normalizedInlineMath.trim();
        const beginMatch = normalizedTrimmed.match(/^\\\\begin\{([^}]+)\}/);

        if (beginMatch) {
            const env = beginMatch[1];
            const block = [normalizedInlineMath];
            let j = i;
            const endRegex = new RegExp(`\\\\\\\\end\\{${env.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`);
            while (j + 1 < lines.length && !endRegex.test(block[block.length - 1].trim())) {
                j += 1;
                block.push(lines[j].replace(/\\\((.+?)\\\)/g, (_, expr) => `$${expr}$`));
            }
            out.push("");
            out.push("$$");
            out.push(...block);
            out.push("$$");
            out.push("");
            i = j;
            continue;
        }

        if (/^\\\\fbox\{/.test(normalizedTrimmed)) {
            out.push("");
            out.push("$$");
            out.push(normalizedInlineMath);
            out.push("$$");
            out.push("");
            continue;
        }

        out.push(normalizedInlineMath);
    }

    let normalized = out.join("\n");
    const protectedBlocks = [];

    normalized = normalized.replace(/```[\s\S]*?```|\$\$[\s\S]*?\$\$/g, (block) => {
        const token = `@@BLOCK_${protectedBlocks.length}@@`;
        protectedBlocks.push(block);
        return token;
    });

    normalized = normalized.replace(
        /(^|\n)(\\begin\{([A-Za-z*]+)\}[\s\S]*?\\end\{\3\})(?=\n|$)/g,
        (_, prefix, block) => `${prefix}\n$$\n${block}\n$$\n`
    );

    normalized = normalized.replace(
        /(^|\n)(\\fbox\{[\s\S]*?\})(?=\n|$)/g,
        (_, prefix, block) => `${prefix}\n$$\n${block}\n$$\n`
    );

    normalized = normalized.replace(/@@BLOCK_(\d+)@@/g, (_, index) => protectedBlocks[Number(index)]);

    return normalized;
}

function setupMarkdownRenderer() {
    marked.setOptions({
        gfm: true,
        breaks: false,
    });

    marked.use(
        markedHighlight({
            langPrefix: "hljs language-",
            highlight(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
        })
    );

    marked.use(
        katexExtFactory({
            throwOnError: false,
            strict: "ignore",
            output: "htmlAndMathml",
            katex,
        })
    );
}

function injectRenderedHtmlIntoTemplate(templateHtml, articleHtml) {
    const articleWithClass = `<article id="markdownRoot" class="panel article-body reveal markdown-content is-visible">\n${articleHtml}\n</article>`;

    if (/<article\b[^>]*id=["']markdownRoot["'][^>]*>[\s\S]*?<\/article>/i.test(templateHtml)) {
        return templateHtml.replace(
            /<article\b[^>]*id=["']markdownRoot["'][^>]*>[\s\S]*?<\/article>/i,
            () => articleWithClass
        );
    }

    if (/<article\b[^>]*>[\s\S]*?<\/article>/i.test(templateHtml)) {
        return templateHtml.replace(/<article\b[^>]*>[\s\S]*?<\/article>/i, () => articleWithClass);
    }

    if (/<main\b[^>]*>[\s\S]*?<\/main>/i.test(templateHtml)) {
        return templateHtml.replace(/<\/main>/i, `${articleWithClass}\n    </main>`);
    }

    return `${templateHtml}\n${articleWithClass}`;
}

// [MỚI] Hàm lấy tiêu đề từ Markdown và đắp vào HTML Template
function inferPostCategory(fileName = "") {
    const lower = String(fileName).toLowerCase();

    if (lower.startsWith("writeup-")) {
        return { label: "Writeup", href: "../categories/writeup.html" };
    }

    if (lower.startsWith("learning-")) {
        return { label: "Learning", href: "../categories/learning.html" };
    }

    if (lower.startsWith("daily-") || lower.startsWith("life-")) {
        return { label: "Life", href: "../categories/life.html" };
    }

    return { label: "Template", href: "writeup-template.html" };
}

function injectMetadata(html, markdown, fallbackDate, outputFileName = "") {
    // Tìm dòng H1 đầu tiên trong Markdown (VD: "# N1CTF 2025")
    const titleMatch = markdown.match(/^#\s+(.*)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled Writeup";

    // 1. Thay thế nội dung thẻ <title> trên tab trình duyệt
    let newHtml = html.replace(/<title>.*?<\/title>/i, `<title>${title} - Nhan's Security Log</title>`);

    // 2. Thay thế chữ "[WRITEUP] TITLE HERE" bên trong thẻ <h1> của giao diện
    newHtml = newHtml.replace(/\[WRITEUP\] TITLE HERE/gi, title);

    const metadata = parseMarkdownMetadata(markdown);
    if (!metadata.hasFrontmatter) {
        return newHtml;
    }

    const date = metadata.date || fallbackDate;
    const category = inferPostCategory(outputFileName);
    const tagsHtml = metadata.tags
        .map((tag) => `<a href="../tags/index.html">${escapeHtml(tag)}</a>`)
        .join("\n                ");
    const postMetaHtml = [
        '<div class="post-meta" style="margin-top: 10px;">',
        `                <span>${escapeHtml(date)}</span>`,
        `                <a href="${escapeHtml(category.href)}">${escapeHtml(category.label)}</a>`,
        tagsHtml ? `                ${tagsHtml}` : "",
        "            </div>",
    ]
        .filter(Boolean)
        .join("\n");

    newHtml = newHtml.replace(
        /<div class="post-meta" style="margin-top: 10px;">[\s\S]*?<\/div>/i,
        () => postMetaHtml
    );
    newHtml = newHtml.replace(/<span>Template<\/span>/i, () => `<span>${escapeHtml(title)}</span>`);
    newHtml = newHtml.replace(
        '<a class="is-active" href="writeup-template.html">Template</a>',
        `<a class="is-active" href="${escapeHtml(category.href)}">${escapeHtml(category.label)}</a>`
    );

    if (metadata.summary) {
        newHtml = newHtml.replace(
            /<p class="lead">[\s\S]*?<\/p>/i,
            () => `<p class="lead">${escapeHtml(metadata.summary)}</p>`
        );
    }

    return newHtml;
}

function removeClientSideMarkdownScripts(html) {
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (block) => {
        if (/(marked|markdown|MathJax|katex|cdn\.jsdelivr|unpkg|fetch\s*\()/i.test(block)) {
            return "";
        }
        return block;
    });
}

function injectLocalCssLinks(html) {
    const highlightHref = "../assets/vendor/highlight/github-dark.min.css";
    const katexHref = "../assets/vendor/katex/katex.min.css";

    const links = [
        `<link rel="stylesheet" href="${highlightHref}">`,
        `<link rel="stylesheet" href="${katexHref}">`,
    ];

    let next = html;
    for (const link of links) {
        if (!next.includes(link)) {
            next = next.replace(/<\/head>/i, `    ${link}\n</head>`);
        }
    }

    return next;
}

async function copyVendorAssets() {
    const highlightCssSrc = require.resolve("highlight.js/styles/github-dark.min.css");
    const katexCssSrc = require.resolve("katex/dist/katex.min.css");
    const katexFontsSrc = path.join(path.dirname(katexCssSrc), "fonts");

    await fs.mkdir(PATHS.vendorHighlightDir, { recursive: true });
    await fs.mkdir(PATHS.vendorKatexDir, { recursive: true });

    await fs.copyFile(highlightCssSrc, path.join(PATHS.vendorHighlightDir, "github-dark.min.css"));
    await fs.copyFile(katexCssSrc, path.join(PATHS.vendorKatexDir, "katex.min.css"));
    await fs.cp(katexFontsSrc, path.join(PATHS.vendorKatexDir, "fonts"), {
        recursive: true,
        force: true,
    });
}

async function build() {
    try {
        setupMarkdownRenderer();

        const files = await fs.readdir(PATHS.postsDir);
        const mdFiles = files.filter(file => file.endsWith(".md"));

        if (mdFiles.length === 0) {
            console.log("⚠️ Không tìm thấy file .md nào trong thư mục posts.");
            return;
        }

        console.log(`🚀 Tìm thấy ${mdFiles.length} file Markdown. Đang tiến hành build...`);

        const templateHtml = await fs.readFile(PATHS.templateHtml, "utf8");
        await copyVendorAssets();
        const allPosts = [];

        for (const file of mdFiles) {
            const inputPath = path.join(PATHS.postsDir, file);
            const outputFileName = file.replace(".md", ".html");
            const outputPath = path.join(PATHS.postsDir, outputFileName);

            const rawMarkdown = await fs.readFile(inputPath, "utf8");
            const stats = await fs.stat(inputPath);
            const fallbackDate = formatDate(stats.mtime);
            const markdownWithoutMetadata = stripMetadataLines(rawMarkdown);
            const cleanedMarkdown = preprocessHackmdMarkdown(markdownWithoutMetadata);

            const originalWarn = console.warn;
            console.warn = (...args) => {
                const first = String(args[0] || "");
                if (/No character metrics/i.test(first)) return;
                originalWarn(...args);
            };

            let renderedArticle;
            try {
                renderedArticle = marked.parse(cleanedMarkdown);
            } finally {
                console.warn = originalWarn;
            }

            let outputHtml = injectRenderedHtmlIntoTemplate(templateHtml, renderedArticle);
            
            // [MỚI] Gọi hàm đắp MetaData (Title) vào file HTML
            outputHtml = injectMetadata(outputHtml, rawMarkdown, fallbackDate, outputFileName);
            
            outputHtml = removeClientSideMarkdownScripts(outputHtml);
            outputHtml = injectLocalCssLinks(outputHtml);

            await fs.writeFile(outputPath, outputHtml, "utf8");

            allPosts.push(
                extractPostMetadata(rawMarkdown, outputFileName, fallbackDate)
            );

            console.log(`✅ Đã build xong: ${file} -> ${outputFileName}`);
        }

        await generateWriteupCategoryPage(allPosts);

        console.log("\n🎉 Quá trình build hoàn tất 100%! Các bài viết đã sẵn sàng.");

    } catch (error) {
        console.error("Build failed:", error.message);
        process.exitCode = 1;
    }
}

build();
