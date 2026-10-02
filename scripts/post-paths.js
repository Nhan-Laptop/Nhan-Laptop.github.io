const fs = require('fs/promises');
const path = require('path');

function encodeUrlPath(value) {
    return value.split('/').map(encodeURIComponent).join('/');
}

// Paths are relative to posts/, which is itself one level below the site root.
function siteRootPrefix(postFile) {
    return '../'.repeat(postFile.split('/').length);
}

async function collectMarkdownFiles(directory, excluded = new Set()) {
    const files = [];
    async function visit(relativeDirectory = '') {
        const entries = await fs.readdir(path.join(directory, relativeDirectory), { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const relative = path.posix.join(relativeDirectory, entry.name);
            if (excluded.has(relative) || excluded.has(entry.name)) continue;
            if (entry.isDirectory()) await visit(relative);
            else if (entry.isFile() && entry.name.endsWith('.md')) files.push(relative);
        }
    }
    await visit();
    return files;
}

module.exports = { encodeUrlPath, siteRootPrefix, collectMarkdownFiles };
