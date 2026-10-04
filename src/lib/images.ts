import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";

/** Large webp for the lightbox, never wider than the source image. */
export async function fullSize(img: ImageMetadata, max = 2400): Promise<string> {
    return (await getImage({ src: img, width: Math.min(img.width, max), format: "webp", quality: 90 })).src;
}
