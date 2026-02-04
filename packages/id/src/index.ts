import { createId as createCuid, init } from "@paralleldrive/cuid2";

/**
 * Entity type prefixes for Posium domain models
 */
const ENTITY_PREFIXES = {
  // Auth
  user: "usr",
  session: "ses",
  account: "acc",
  verification: "vrf",
  org: "org",
  orgMember: "om",
  apikey: "key",
  invitation: "inv",

  // Projects
  project: "prj",
  projectMember: "pm",

  // Tests
  suite: "sui",
  test: "tst",
  testVersion: "tv",
  testDraft: "td",
  module: "mod",
  moduleVersion: "mv",

  // Environments
  environment: "env",
  environmentSecret: "evs",

  // Planning
  plan: "pln",
  planItem: "pi",
  schedule: "sch",

  // Execution
  run: "run",
  runTest: "rt",
  reportEvent: "re",
  runArtifact: "ra",

  // AI Editor
  aiConversation: "aic",
  aiMessage: "aim",
  aiMessageFeedback: "amf",

  // Integrations
  integration: "int",

  // Webhooks
  projectHook: "ph",
  projectHookSub: "phs",
  projectHookLog: "phl",

  // Tags
  tag: "tag",
  testTag: "tt",
  suiteTag: "st",

  // Notifs
  orgMemberNotifChannel: "nc",
  orgMemberNotifRule: "nr",
  orgMemberNotifLog: "nl",

  // Audit
  auditLog: "al",
} as const;

/**
 * Custom ID lengths for specific entity types (excluding prefix)
 * Entities not listed here use the default cuid2 length (24)
 */
const ENTITY_LENGTHS: Partial<Record<keyof typeof ENTITY_PREFIXES, number>> = {
  org: 5,
  project: 7,
  run: 14,
  test: 9,
  suite: 8,
  schedule: 10,
  module: 10,
  environment: 10,
  environmentSecret: 10,
  plan: 12,
};

/**
 * Cache of cuid2 generators by length for performance
 */
const generatorCache = new Map<number, () => string>();

/**
 * Get or create a cuid2 generator for a specific length
 */
function getGenerator(length: number): () => string {
  let generator = generatorCache.get(length);
  if (!generator) {
    generator = init({ length });
    generatorCache.set(length, generator);
  }
  return generator;
}

/**
 * Valid entity types for ID generation
 */
export type EntityType = keyof typeof ENTITY_PREFIXES;

/**
 * Custom error thrown when an invalid entity type is provided
 */
export class InvalidEntityError extends Error {
  constructor(entityType: string) {
    super(
      `Invalid entity type: ${entityType}. Valid types are: ${Object.keys(ENTITY_PREFIXES).join(", ")}`,
    );
    this.name = "InvalidEntityError";
  }
}

/**
 * Creates a prefixed ID for a given entity type
 *
 * @param entityType - The type of entity to create an ID for
 * @returns A prefixed ID in the format: prefix_cuid2
 * @throws InvalidEntityError if the entity type is not valid
 *
 * @example
 * createId('user') // Returns: usr_cl9x8k2n000000d0e8y8z8b0w
 * createId('org') // Returns: org_a1b2c (5 chars)
 * createId('run') // Returns: run_a1b2c3d4e5f6g7 (14 chars)
 */
export function createId(entityType: EntityType): string {
  const prefix = ENTITY_PREFIXES[entityType];

  if (!prefix) {
    throw new InvalidEntityError(entityType);
  }

  const customLength = ENTITY_LENGTHS[entityType];
  if (customLength) {
    const generator = getGenerator(customLength);
    return `${prefix}_${generator()}`;
  }

  return `${prefix}_${createCuid()}`;
}

/**
 * Type guard to check if a string is a valid entity type
 *
 * @param entityType - The string to check
 * @returns True if the entity type is valid
 *
 * @example
 * isValidEntityType('user') // Returns: true
 * isValidEntityType('invalid') // Returns: false
 */
export function isValidEntityType(
  entityType: string,
): entityType is EntityType {
  return entityType in ENTITY_PREFIXES;
}

/**
 * Returns an array of all valid entity types
 *
 * @returns Array of valid entity types
 *
 * @example
 * getValidEntityTypes() // Returns: ['user', 'session', 'account', ...]
 */
export function getValidEntityTypes(): EntityType[] {
  return Object.keys(ENTITY_PREFIXES) as EntityType[];
}
