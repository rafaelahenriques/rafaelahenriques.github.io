import { getCollection, type CollectionEntry } from "astro:content";

export type ProjectEntry = CollectionEntry<"projects">;

/** URL slug for an entry ("thrive/index.md" style ids → "thrive"). */
export const slugOf = (entry: { id: string }) => entry.id.replace(/\.md$/, "");

/** Featured projects by their number, then other work, newest first. */
export async function getProjects(): Promise<ProjectEntry[]> {
    const projects = await getCollection("projects");
    return projects.sort((a, b) => {
        const bySection = Number(a.data.section === "other") - Number(b.data.section === "other");
        const byOrder = (a.data.order ?? 99) - (b.data.order ?? 99);
        const byYear = (b.data.year ?? "").localeCompare(a.data.year ?? "");
        return bySection || byOrder || byYear || a.data.title.localeCompare(b.data.title);
    });
}

export async function getFeatured(): Promise<ProjectEntry[]> {
    return (await getProjects()).filter((p) => p.data.section === "featured");
}

export async function getOtherWork(): Promise<ProjectEntry[]> {
    return (await getProjects()).filter((p) => p.data.section === "other");
}

export const pad = (n: number) => String(n).padStart(2, "0");
