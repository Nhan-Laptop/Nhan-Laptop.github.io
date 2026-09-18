const fs = require('fs/promises');
const path = require('path');

function dimensions(buffer) {
    if (buffer.length >= 24 && buffer.subarray(1, 4).toString() === 'PNG') {
        return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
    }
    if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
    const type = buffer.toString('ascii', 12, 16);
    if (type === 'VP8X') return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
    if (type === 'VP8 ') return [buffer.readUInt16LE(26) & 16383, buffer.readUInt16LE(28) & 16383];
    if (type === 'VP8L') {
        const bits = buffer.readUInt32LE(21);
        return [(bits & 16383) + 1, ((bits >>> 14) & 16383) + 1];
    }
    return null;
}

async function addLocalImageDimensions(html, postsDir, root) {
    const replacements = new Map();
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
        const tag = match[0];
        if (/\bwidth=/.test(tag) && /\bheight=/.test(tag)) continue;
        const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
        if (!src || /^(?:[a-z]+:|\/\/)/i.test(src)) continue;
        let target;
        try { target = path.resolve(postsDir, decodeURIComponent(src)); } catch { continue; }
        if (!target.startsWith(root + path.sep)) continue;
        try {
            const size = dimensions(await fs.readFile(target));
            if (!size) continue;
            let updated = tag;
            if (!/\bwidth=/.test(tag)) updated = updated.replace('<img', `<img width="${size[0]}"`);
            if (!/\bheight=/.test(tag)) updated = updated.replace('<img', `<img height="${size[1]}"`);
            replacements.set(tag, updated);
        } catch { /* The link audit reports missing assets separately. */ }
    }
    return html.replace(/<img\b[^>]*>/gi, tag => replacements.get(tag) || tag);
}
module.exports = { dimensions, addLocalImageDimensions };
