import { headers } from "next/headers";
import { cache } from "react";
import type { Auth } from "../server/index.js";

/**
 * Creates a cached session getter for Next.js server components.
 *
 * Uses React's `cache()` to deduplicate session fetches within a single request.
 *
 * @example
 * ```ts
 * // app/lib/auth.ts
 * import { createAuth } from "@posium/auth/server";
 * import { createGetSession } from "@posium/auth/next";
 * import { db } from "./db";
 *
 * export const auth = createAuth(db, config);
 * export const getSession = createGetSession(auth);
 *
 * // app/page.tsx
 * import { getSession } from "./lib/auth";
 *
 * export default async function Page() {
 *   const session = await getSession();
 *   if (!session) return <LoginButton />;
 *   return <Dashboard user={session.user} />;
 * }
 * ```
 */
export function createGetSession(auth: Auth) {
  return cache(async () => {
    return auth.api.getSession({
      headers: await headers(),
    });
  });
}

// Re-export the Next.js handler for convenience
export { toNextJsHandler } from "better-auth/next-js";
