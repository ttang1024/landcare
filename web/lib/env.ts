import { z } from "zod";

/**
 * Public env only. Secrets (AI/GIS keys, tokens) NEVER appear here — they live
 * server-side in the PHP API (Module 12). NEXT_PUBLIC_* is the only client surface.
 */
const schema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:8080"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["en", "mi"]).default("en"),
});

export const env = schema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
});
