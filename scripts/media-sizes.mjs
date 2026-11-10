// After the build: the size of every file under dist/media, for the Worker
// (worker/index.js), which has to say how big a video is when it sends part of
// it, and can't read that from the static assets. Written to
// worker/media-sizes.json, sorted, so it only changes when the media does.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const dist = "dist";
const sizes = {};
const walk = (dir) => {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        const stat = statSync(path);
        if (stat.isDirectory()) walk(path);
        else sizes["/" + relative(dist, path).split("\\").join("/")] = stat.size;
    }
};
walk(join(dist, "media"));
const sorted = Object.fromEntries(Object.keys(sizes).sort().map((k) => [k, sizes[k]]));
writeFileSync("worker/media-sizes.json", JSON.stringify(sorted, null, 1) + "\n");
console.log(`media sizes: ${Object.keys(sorted).length} files`);
