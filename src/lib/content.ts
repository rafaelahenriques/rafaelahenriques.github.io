import { getCollection, type CollectionEntry } from "astro:content";

export type ProjectEntry = CollectionEntry<"projects">;

/** URL slug for an entry ("thrive/index.md" style ids → "thrive"). */
export const slugOf = (entry: { id: string }) => entry.id.replace(/\.md$/, "");

/** Newest year first, then alphabetical. */
export async function getProjects(): Promise<ProjectEntry[]> {
    const projects = await getCollection("projects");
    return projects.sort((a, b) => {
        const byYear = (b.data.year ?? "").localeCompare(a.data.year ?? "");
        return byYear || a.data.title.localeCompare(b.data.title);
    });
}

export const pad = (n: number) => String(n).padStart(2, "0");
