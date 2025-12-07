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
          // use Astro's image() helper for optimized images
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
      date: z.date(), // matches how you're using date in code
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
});

export const collections = { projects, blog };