/**
 * Video files, answered a piece at a time.
 *
 * Cloudflare's static assets ignore the Range header: asked for part of a
 * file, they send all of it with a 200. Chrome copes, but Safari (Mac and
 * iPhone) asks for the first two bytes before it plays anything, and without
 * a 206 back it won't play the video at all. So /media/* comes here first
 * (wrangler.jsonc: run_worker_first): the file is fetched from the assets
 * whole, and the bytes asked for are cut out of the stream on the way through,
 * never held in memory. Its size comes from media-sizes.json, which the build
 * writes (scripts/media-sizes.mjs). Everything else on the site is served as
 * before, without this.
 */

import SIZES from "./media-sizes.json";

const MEDIA_CACHE = "public, max-age=2592000";

export default {
    async fetch(request, env) {
        // the asset, asked for whole (its own conditional headers kept, so a 304 still works)
        const headers = new Headers(request.headers);
        headers.delete("Range");
        headers.delete("If-Range");
        const asset = await env.ASSETS.fetch(new Request(request.url, { method: request.method, headers }));
        if (asset.status !== 200) return asset;

        const out = new Headers(asset.headers);
        out.set("Accept-Ranges", "bytes");
        if (!out.has("Cache-Control")) out.set("Cache-Control", MEDIA_CACHE);
        // the file's size, from the table the build writes (inside a Worker the
        // assets don't say how long they are)
        const path = decodeURIComponent(new URL(request.url).pathname);
        const size = SIZES[path] ?? Number(asset.headers.get("Content-Length"));
        const range = parse(request.headers.get("Range"), size);
        // no range (or one we don't do, like several at once): the whole file, as before
        if (!range) return new Response(asset.body, { status: 200, headers: out });

        if (range === "unsatisfiable") {
            await asset.body?.cancel();
            out.set("Content-Range", `bytes */${size}`);
            out.delete("Content-Length");
            return new Response(null, { status: 416, headers: out });
        }

        const { start, end } = range;
        const length = end - start + 1;
        out.set("Content-Range", `bytes ${start}-${end}/${size}`);
        out.set("Content-Length", String(length));
        if (request.method === "HEAD" || !asset.body) return new Response(null, { status: 206, headers: out });
        // the whole file asked for as a range ("bytes=0-", how Chrome starts): straight through, nothing to cut
        if (start === 0 && end === size - 1) return new Response(asset.body.pipeThrough(new FixedLengthStream(length)), { status: 206, headers: out });
        // a fixed-length stream, so the browser is told exactly how much is coming
        const body = asset.body.pipeThrough(slice(start, end)).pipeThrough(new FixedLengthStream(length));
        return new Response(body, { status: 206, headers: out });
    },
};

/** "bytes=a-b", "bytes=a-" or "bytes=-n" against a file of `size` bytes */
function parse(header, size) {
    if (!header || !Number.isFinite(size) || size <= 0) return null;
    const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!m || (m[1] === "" && m[2] === "")) return null;
    let start;
    let end;
    if (m[1] === "") {
        // the last n bytes
        start = Math.max(0, size - Number(m[2]));
        end = size - 1;
    } else {
        start = Number(m[1]);
        end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start >= size || start > end) return "unsatisfiable";
    return { start, end };
}

/** passes on only bytes start…end (inclusive) of a stream, then stops reading it */
function slice(start, end) {
    let at = 0;
    return new TransformStream({
        transform(chunk, controller) {
            const from = at;
            at += chunk.byteLength;
            if (at <= start) return;
            controller.enqueue(chunk.subarray(Math.max(0, start - from), Math.min(chunk.byteLength, end - from + 1)));
            if (at > end) controller.terminate();
        },
    });
}
