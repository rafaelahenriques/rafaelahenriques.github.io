import { defineCollection, z } from "astro:content";

const projects = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
        year: z.string().optional(),
        description: z.string().optional(),
        tech: z.array(z.string()).optional(),
        role: z.string().optional(),
        context: z.string().optional(),
        scope: z.array(z.string()).optional(),
        media: z
            .object({
                repo: z.string().optional(),
                screenshot: z.string().optional(),
                video: z.string().optional(),
                gallery: z.array(z.string()).optional(),
            })
            .optional(),
        tags: z.array(z.string()).optional(),
        layout: z.string().optional(),

    }),
});


const blog = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
        date: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        layout: z.string().optional(),
    }),
});

export const collections = { projects, blog };
