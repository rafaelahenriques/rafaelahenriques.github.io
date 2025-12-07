// src/content.config.ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

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
          video: z.string().url().optional(),
          screenshot: image().optional(),
          gallery: z.array(image()).optional(),
        })
        .optional(),
      tags: z.array(z.string()).optional(),
    }),
});

// BLOG COLLECTION
const blog = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/blog",
  }),
  schema: () =>
    z.object({
      title: z.string(),
      date: z.date(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
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

export const collections = { projects, blog, skills };