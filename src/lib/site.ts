import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Contact details and profile links, used by the header, footer and about page.
 * Leave a value empty to hide its link.
 */
export const site = {
    email: "rafaela.henriques.work@gmail.com",
    github: "https://github.com/rafaelahenriques",
    linkedin: "https://www.linkedin.com/in/rafaelarosahenriques/",
    cv: "/Rafaela_Henriques_Resume.pdf", // the file lives in public/
    location: "Kortrijk, BE",
    timeZone: "Europe/Brussels",
    availability: "Open to software & web development roles",
};

// Only link the CV once the file actually exists, so the build never ships a 404.
const hasCv = existsSync(join(process.cwd(), "public", site.cv));

export interface ContactLink {
    label: string;
    href: string;
    /** opens in a new tab, marked ↗: the profiles, and the résumé PDF */
    newTab?: boolean;
}

export const contactLinks: ContactLink[] = [
    ...(hasCv ? [{ label: "Resume", href: site.cv, newTab: true }] : []),
    ...(site.linkedin ? [{ label: "LinkedIn", href: site.linkedin, newTab: true }] : []),
    ...(site.github ? [{ label: "GitHub", href: site.github, newTab: true }] : []),
    { label: "Email", href: `mailto:${site.email}` },
];
