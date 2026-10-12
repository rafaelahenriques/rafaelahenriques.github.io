/**
 * Structured data (schema.org JSON-LD) for search engines. BaseLayout always
 * adds the Person; pages add what they are on top of it (the home page a
 * WebSite, About a ProfilePage, each project a CreativeWork + breadcrumb).
 * Everything points at the same Person through PERSON_ID, so Google can tell
 * the site, the profiles and the projects all belong to one person.
 */
import type { ImageMetadata } from "astro";
import { site } from "./site";
import { slugOf, type ProjectEntry } from "./content";

export const SITE_URL = (import.meta.env.SITE ?? "https://rafaelahenriques.com").replace(/\/$/, "");
export const PERSON_ID = `${SITE_URL}/#person`;
export const NAME = "Rafaela Henriques";

export type Schema = Record<string, unknown>;

const absolute = (path: string) => new URL(path, SITE_URL).href;

export function personSchema(imageUrl?: string): Schema {
    return {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": PERSON_ID,
        name: NAME,
        url: `${SITE_URL}/`,
        image: imageUrl,
        jobTitle: "Web developer",
        description:
            "Angolan-Portuguese developer based in Belgium, studying Digital Design & Development at Howest (Creative Development major, Experience Design minor).",
        address: { "@type": "PostalAddress", addressLocality: "Kortrijk", addressCountry: "BE" },
        affiliation: { "@type": "CollegeOrUniversity", name: "Howest University of Applied Sciences" },
        knowsAbout: ["Web development", "Full-stack development", "Mobile development", "TypeScript", "React", "React Native", "Python", "Creative development", "GSAP"],
        sameAs: [site.linkedin, site.github].filter(Boolean),
    };
}

export function websiteSchema(): Schema {
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: NAME,
        url: `${SITE_URL}/`,
        inLanguage: "en",
        publisher: { "@id": PERSON_ID },
    };
}

export function profilePageSchema(path: string): Schema {
    return {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        url: absolute(path),
        mainEntity: { "@id": PERSON_ID },
    };
}

export function breadcrumbSchema(items: { name: string; path: string }[]): Schema {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.name,
            item: absolute(item.path),
        })),
    };
}

/** Share image and structured data for a project page. */
export function projectSeo(project: ProjectEntry): { image?: ImageMetadata; type: "article"; schema: Schema[] } {
    const { title, description, year, tech, media } = project.data;
    const path = `/projects/${slugOf(project)}/`;
    return {
        image: media?.screenshot,
        type: "article",
        schema: [
            {
                "@context": "https://schema.org",
                "@type": "CreativeWork",
                name: title,
                description,
                url: absolute(path),
                dateCreated: year,
                keywords: tech?.join(", "),
                inLanguage: "en",
                author: { "@id": PERSON_ID },
                creator: { "@id": PERSON_ID },
                // the live site and the code are the same work, elsewhere
                ...(media?.live || media?.repo ? { sameAs: [media?.live, media?.repo].filter(Boolean) } : {}),
            },
            breadcrumbSchema([
                { name: "Home", path: "/" },
                { name: "Projects", path: "/projects/" },
                { name: title, path },
            ]),
        ],
    };
}
