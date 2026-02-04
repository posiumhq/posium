import { createAuthClient } from "better-auth/react";
import {
  organizationClient,
  apiKeyClient,
  adminClient,
} from "better-auth/client/plugins";

/**
 * React auth client with all plugins enabled.
 * Matches the server-side plugin configuration.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient(), apiKeyClient(), adminClient()],
});

/** Session type inferred from the auth client */
export type Session = typeof authClient.$Infer.Session;

/** User type extracted from session */
export type User = Session["user"];
