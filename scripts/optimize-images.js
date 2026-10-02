const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TARGETS = [
    path.join(ROOT, "self.png"),
    path.join(ROOT, "assets", "greycatfinal"),
    path.join(ROOT, "assets", "malware"),
];

function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: "inherit" });
        child.once("error", reject);
        child.once("exit", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${command} exited with code ${code}`));
        });
    });
}

async function collectPngs(target) {
    const stats = await fs.stat(target);
    if (stats.isFile()) return target.toLowerCase().endsWith(".png") ? [target] : [];

    const entries = await fs.readdir(target, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map((entry) => collectPngs(path.join(target, entry.name)))
    );
    return nested.flat();
}

async function shouldBuild(source, output) {
    try {
        const [sourceStats, outputStats] = await Promise.all([
            fs.stat(source),
            fs.stat(output),
        ]);
        return sourceStats.mtimeMs > outputStats.mtimeMs;
    } catch {
        return true;
    }
}

async function main() {
    const sources = (await Promise.all(TARGETS.map(collectPngs))).flat();
    let converted = 0;

    for (const source of sources) {
        const output = source.replace(/\.png$/i, ".webp");
        if (!(await shouldBuild(source, output))) continue;

        console.log(`Optimizing ${path.relative(ROOT, source)} -> ${path.relative(ROOT, output)}`);
        await run("magick", [
            source,
            "-auto-orient",
            "-resize",
            "1800x1800>",
            "-strip",
            "-quality",
            "82",
            output,
        ]);
        converted += 1;
    }

    console.log(`Image optimization complete (${converted} converted, ${sources.length - converted} current).`);
}

main().catch((error) => {
    console.error(`Image optimization failed: ${error.message}`);
    process.exitCode = 1;
});
