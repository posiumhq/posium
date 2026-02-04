import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  OPENROUTER_API_KEY: z.string().optional(),
  BROWSER_MANAGER_HOST: z.string().default("localhost:3003"),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_AI_GATEWAY_TOKEN: z.string().optional(),
  BROWSER_MANAGER_HOST_URL: z.string().default("test"),
});

export const env = envSchema.parse({
  NODE_ENV: process.env["NODE_ENV"],
  OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"],
  BROWSER_MANAGER_HOST: process.env["BROWSER_MANAGER_HOST"],
  CLOUDFLARE_ACCOUNT_ID: process.env["CLOUDFLARE_ACCOUNT_ID"],
  CLOUDFLARE_AI_GATEWAY_TOKEN: process.env["CLOUDFLARE_AI_GATEWAY_TOKEN"],
  BROWSER_MANAGER_HOST_URL: process.env["BROWSER_MANAGER_HOST_URL"],
});
