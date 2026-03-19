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
    vendorHighlightDir: path.join(ROOT, "assets", "vendor", "highlight"),
    vendorKatexDir: path.join(ROOT, "assets", "vendor", "katex"),
};

function preprocessHackmdMarkdown(input) {
    let text = input.replace(/\r\n/g, "\n");

    // 1) Remove HackMD language suffix
    text = text.replace(/^```([A-Za-z0-9_+\-]+)!\s*$/gm, "```$1");

    // 2) Convert :::spoiler to <details>
    text = text.replace(/:::spoiler(?:\s+([^\n]+))?\n([\s\S]*?)\n:::/g, (_, title, body) => {
        const safeTitle = (title || "Bấm để xem chi tiết").trim();
        return `<details>\n<summary>${safeTitle}</summary>\n\n${body}\n\n</details>`;
    });

    // 3) Wrap bare LaTeX block lines
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

        const beginMatch = line.match(/\\begin\{(array|bmatrix|aligned)\}/);

        if (beginMatch) {
            const env = beginMatch[1];
            const block = [line];
            let j = i;
            const endRegex = new RegExp(`\\\\end\\{${env}\\}`);
            while (j + 1 < lines.length && !endRegex.test(lines[j])) {
                j += 1;
                block.push(lines[j]);
                if (endRegex.test(lines[j])) {
                    break;
                }
            }
            out.push("$$");
            out.push(...block);
            out.push("$$");
            i = j;
            continue;
        }

        if (/^\\fbox\{/.test(trimmed)) {
            out.push("$$");
            out.push(line);
            out.push("$$");
            continue;
        }

        out.push(line);
    }

    return out.join("\n");
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
            articleWithClass
        );
    }

    if (/<article\b[^>]*>[\s\S]*?<\/article>/i.test(templateHtml)) {
        return templateHtml.replace(/<article\b[^>]*>[\s\S]*?<\/article>/i, articleWithClass);
    }

    if (/<main\b[^>]*>[\s\S]*?<\/main>/i.test(templateHtml)) {
        return templateHtml.replace(/<\/main>/i, `${articleWithClass}\n    </main>`);
    }

    return `${templateHtml}\n${articleWithClass}`;
}

// [MỚI] Hàm lấy tiêu đề từ Markdown và đắp vào HTML Template
function injectMetadata(html, markdown) {
    // Tìm dòng H1 đầu tiên trong Markdown (VD: "# N1CTF 2025")
    const titleMatch = markdown.match(/^#\s+(.*)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled Writeup";

    // 1. Thay thế nội dung thẻ <title> trên tab trình duyệt
    let newHtml = html.replace(/<title>.*?<\/title>/i, `<title>${title} - Nhan's Security Log</title>`);

    // 2. Thay thế chữ "[WRITEUP] TITLE HERE" bên trong thẻ <h1> của giao diện
    newHtml = newHtml.replace(/\[WRITEUP\] TITLE HERE/gi, title);

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

        for (const file of mdFiles) {
            const inputPath = path.join(PATHS.postsDir, file);
            const outputFileName = file.replace(".md", ".html");
            const outputPath = path.join(PATHS.postsDir, outputFileName);

            const rawMarkdown = await fs.readFile(inputPath, "utf8");
            const cleanedMarkdown = preprocessHackmdMarkdown(rawMarkdown);

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
            outputHtml = injectMetadata(outputHtml, rawMarkdown); 
            
            outputHtml = removeClientSideMarkdownScripts(outputHtml);
            outputHtml = injectLocalCssLinks(outputHtml);

            await fs.writeFile(outputPath, outputHtml, "utf8");
            console.log(`✅ Đã build xong: ${file} -> ${outputFileName}`);
        }

        console.log("\n🎉 Quá trình build hoàn tất 100%! Các bài viết đã sẵn sàng.");

    } catch (error) {
        console.error("Build failed:", error.message);
        process.exitCode = 1;
    }
}

build();