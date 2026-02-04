// Re-export commonly used types from subpaths for convenience
export type {
  Auth,
  AuthConfig,
  AuthDatabase,
  ServerSession,
} from "./server/index.js";

export type { Session, User } from "./client/index.js";
