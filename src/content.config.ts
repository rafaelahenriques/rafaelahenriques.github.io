// src/content.config.ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// A short label with optional one-line explanation (pipeline stages, metrics)
const labelled = z.object({ label: z.string(), detail: z.string().optional() });

// PROJECTS COLLECTION
const projects = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/projects",
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      year: z.string().optional(),
      tech: z.array(z.string()).optional(),
      role: z.string().optional(),
      context: z.string().optional(),
      scope: z.array(z.string()).optional(),
      outcome: z.string().optional(),
      description: z.string().optional(),
      media: z
        .object({
          repo: z.string().url().optional(),
          live: z.string().url().optional(),
          video: z.string().url().optional(),
          screenshot: image().optional(),
          // Projects page list / grid only; falls back to the screenshot
          thumbnail: image().optional(),
          gallery: z.array(image()).optional(),
        })
        .optional(),
      tags: z.array(z.string()).optional(),
      // Portfolio structure: 4 numbered featured projects + smaller "other work"
      section: z.enum(["featured", "other"]).default("featured"),
      order: z.number().optional(),
      status: z.enum(["complete", "in-progress"]).default("complete"),
      category: z.string().optional(),
      // Optional system overview: pipeline stages and the metrics it reports
      architecture: z.array(labelled).optional(),
      metrics: z.array(labelled).optional(),
      // Projects with their own page in src/pages/projects/ (e.g. case studies)
      customPage: z.boolean().optional(),
      // Home page Game Boy: a one-line summary beside it, and the clip on its
      // screen (a path under public/, with a .jpg poster of the same name beside it)
      tagline: z.string().optional(),
      clip: z.string().optional(),
      // Projects page filters this project appears under (labels in lib/content.ts)
      types: z.array(z.enum(["web", "mobile", "fullstack", "data", "interactive", "motion", "branding", "ui"])).default([]),
    }),
});

// ABOUT / SKILLS COLLECTION
const skills = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/about",
  }),
  schema: () =>
    z.object({
      category: z.string(),          // e.g. "Web", "Programming"
      items: z.array(z.string()),    // e.g. ["HTML", "CSS", "Astro"]
      order: z.number().optional(),  // for manual ordering
    }),
});

export const collections = { projects, skills };