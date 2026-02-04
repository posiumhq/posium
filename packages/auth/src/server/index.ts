// Core auth configuration
export {
  createAuth,
  type Auth,
  type AuthConfig,
  type AuthDatabase,
  type ServerSession,
} from "./config.js";

// API key types
export type {
  ApiKeyMetadata,
  CreateKeyInput,
  UpdateKeyInput,
  ApiKeyInfo,
  CreateKeyResult,
} from "./types.js";

// API key utilities
export {
  getServiceUserEmail,
  parseApiKeyMetadata,
  parsePermissions,
  buildPermissions,
  extractProjectIds,
  hasOrgPermission,
  buildMetadata,
} from "./api-key-utils.js";

// Service user management
export {
  getOrCreateServiceUser,
  deleteServiceUser,
} from "./service-user.js";

// API key authorization
export {
  isOrgAdmin,
  canAccessProjects,
  canCreateKey,
  canManageKey,
  getAccessibleProjectIds,
} from "./api-key-auth.js";

// API key CRUD operations
export {
  createKey,
  listKeys,
  updateKey,
  deleteKey,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from "./api-keys.js";
