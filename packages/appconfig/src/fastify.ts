import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { z } from "zod";
import { AppConfig } from "./index.js";
import type { AppConfigOptions } from "./types.js";

/**
 * Options for the Fastify AppConfig plugin
 */
export type FastifyAppConfigPluginOptions<
  TSchema extends z.ZodObject<z.ZodRawShape>,
> = AppConfigOptions<TSchema>;

/**
 * Fastify plugin that initializes AppConfig and decorates the instance
 *
 * @example
 * ```typescript
 * import Fastify from "fastify";
 * import { appConfigPlugin } from "@posium/appconfig/fastify";
 * import { z } from "zod";
 *
 * const schema = z.object({
 *   port: z.number().default(3000),
 *   features: z.object({
 *     darkMode: z.boolean().default(false),
 *   }).default({}),
 * });
 *
 * const fastify = Fastify();
 *
 * await fastify.register(appConfigPlugin, {
 *   schema,
 *   configDir: "./appconfig",
 *   statsig: { secretKey: process.env.STATSIG_SECRET_KEY },
 * });
 *
 * // Access config via fastify.appconfig
 * const port = fastify.appconfig.get("port");
 * const darkMode = fastify.appconfig.get("features.darkMode");
 * ```
 */
const appConfigPluginAsync: FastifyPluginAsync<
  FastifyAppConfigPluginOptions<z.ZodObject<z.ZodRawShape>>
> = async (fastify, opts) => {
  const appconfig = new AppConfig(opts);

  await appconfig.initialize();

  // Log config status
  fastify.log.info(
    {
      environment: appconfig.currentEnvironment,
      configFiles: appconfig.configFiles,
      statsigAvailable: appconfig.isStatsigAvailable,
    },
    "AppConfig initialized",
  );

  // Decorate with appconfig
  fastify.decorate("appconfig", appconfig);

  // Graceful shutdown
  fastify.addHook("onClose", async () => {
    fastify.log.info("Shutting down AppConfig");
    await appconfig.shutdown();
  });
};

/**
 * Fastify plugin for AppConfig
 * Registers AppConfig as `fastify.appconfig`
 */
export const appConfigPlugin = fp(appConfigPluginAsync, {
  name: "appconfig",
  fastify: "5.x",
});

// Re-export AppConfig class for type declarations
export { AppConfig } from "./index.js";
export type { AppConfigOptions } from "./types.js";

/**
 * TypeScript declaration merging for Fastify
 *
 * Apps should extend FastifyInstance with their specific schema type:
 *
 * @example
 * ```typescript
 * import { AppConfig } from "@posium/appconfig/fastify";
 *
 * declare module "fastify" {
 *   interface FastifyInstance {
 *     appconfig: AppConfig<typeof mySchema>;
 *   }
 * }
 * ```
 */
