# @posium/appconfig

Runtime dynamic configuration with type safety for Node.js applications.

## Features

- **Type-safe configuration** using Zod schemas
- **Environment variable mapping** via `.env()` schema extension
- **Directory-based config files** with environment-specific overrides
- **Environment normalization** (`dev` → `development`, `prod` → `production`)
- **Optional Statsig integration** for runtime dynamic config updates
- **Deep merge** of config sources (Env Vars > Statsig > Env File > Base File > Schema defaults)
- **OSS-friendly** - works without Statsig when secret key not provided

## Installation

```bash
pnpm add @posium/appconfig zod

# Optional: Install Statsig for dynamic config
pnpm add statsig-node
```

## Quick Start

```typescript
import { AppConfig } from "@posium/appconfig";
import { z } from "zod";

// 1. Define your config schema with defaults
const configSchema = z.object({
  rateLimitPerMinute: z.number().default(100),
  maxUploadSizeMb: z.number().default(10),
  features: z
    .object({
      darkMode: z.boolean().default(false),
      betaFeatures: z.boolean().default(false),
    })
    .default({}),
});

// 2. Create config instance
const config = new AppConfig({
  schema: configSchema,
  // configDir defaults to "./appconfig"
  // environment auto-detects from NODE_ENV
});

// 3. Initialize (required before use)
await config.initialize();

// 4. Access config values (type-safe!)
const limit = config.get("rateLimitPerMinute"); // number
const features = config.get("features"); // { darkMode: boolean, betaFeatures: boolean }

// 5. Cleanup on shutdown
await config.shutdown();
```

## Directory-Based Config Files

AppConfig loads configuration from a directory containing JSON files:

```
appconfig/                      # Default directory (configurable)
├── config.json                 # Base config (always loaded first)
├── config.development.json     # Development overrides
├── config.staging.json         # Staging overrides
├── config.production.json      # Production overrides
└── config.test.json            # Test overrides
```

### Environment Detection

The environment is determined in this order:

1. **Explicit `environment` option** - `new AppConfig({ environment: "production" })`
2. **NODE_ENV** - Falls back to `process.env.NODE_ENV`
3. **Default** - Uses `"development"` if nothing is set

### Environment Aliases

Common aliases are automatically normalized:

| Input                      | Normalized    |
| -------------------------- | ------------- |
| `dev`, `development`       | `development` |
| `prod`, `production`       | `production`  |
| `stage`, `stag`, `staging` | `staging`     |
| `test`, `testing`          | `test`        |

```typescript
// These are equivalent:
new AppConfig({ schema, environment: "dev" });
new AppConfig({ schema, environment: "development" });
```

### Config Loading Order

1. Load `config.json` (base config)
2. Deep merge `config.<environment>.json` on top (if exists)
3. Deep merge Statsig values on top (if configured)
4. Deep merge environment variables on top
5. Validate against Zod schema and apply defaults

## Environment Variables

Map environment variables to config paths using the `.env()` schema extension:

```typescript
import { z } from "zod";
import "@posium/appconfig/zod-env"; // Activate .env() extension

const schema = z.object({
  port: z.coerce.number().default(3000).env("PORT"),
  database: z.object({
    url: z.string().env("DATABASE_URL"),
    poolSize: z.number().default(10).env("DB_POOL_SIZE"),
  }),
});

const config = new AppConfig({ schema });
await config.initialize();

// With PORT=8080 and DATABASE_URL=postgres://localhost/mydb:
config.get("port");         // 8080
config.get("database.url"); // "postgres://localhost/mydb"
```

The `.env()` method works with any Zod type and chains with other methods:

```typescript
z.string().min(1).env("API_KEY")           // Required string from env
z.coerce.number().default(3000).env("PORT") // Coerced number with default
z.string().optional().env("DEBUG_MODE")     // Optional string from env
```

## How It Works

### Config Priority (highest to lowest)

1. **Environment Variables** - Values from `.env()` mappings
2. **Statsig** - Runtime dynamic values (if configured)
3. **Environment File** - `config.<env>.json` values
4. **Base File** - `config.json` values
5. **Schema defaults** - Zod schema default values

### Deep Merge Behavior

Config sources are deep merged at each nested level:

```typescript
// config.json:                  { api: { timeout: 5000, retries: 3 } }
// config.production.json:       { api: { timeout: 10000 } }
// Result:                       { api: { timeout: 10000, retries: 3 } }
```

### Performance

- **File config** is loaded **once** at `initialize()`
- Restart the application to reload file changes
- **Statsig** provides runtime dynamic updates via background sync

## Usage

### Basic Usage (OSS - No Statsig)

```typescript
import { AppConfig } from "@posium/appconfig";
import { z } from "zod";

const schema = z.object({
  port: z.number().default(3000),
  debug: z.boolean().default(false),
  database: z
    .object({
      host: z.string().default("localhost"),
      port: z.number().default(5432),
    })
    .default({}),
});

const config = new AppConfig({
  schema,
  configDir: "./appconfig", // Optional, this is the default
  environment: "production", // Optional, auto-detects from NODE_ENV
});

await config.initialize();

// Check current environment
console.log(config.currentEnvironment); // "production"

// See which files were loaded
console.log(config.configFiles); // ["/path/to/appconfig/config.json", "/path/to/appconfig/config.production.json"]

// Type-safe access
const port = config.get("port"); // number
const db = config.get("database"); // { host: string, port: number }

// Get entire config
const all = config.getAll();
```

### With Statsig Integration

```typescript
const config = new AppConfig({
  schema,
  configDir: "./appconfig",
  environment: "production", // Used for both file loading AND Statsig tier
  statsig: {
    // secretKey defaults to process.env.STATSIG_SECRET_KEY
    configName: "server_config", // Name of Dynamic Config in Statsig
  },
});

await config.initialize();

// Check if Statsig is active
if (config.isStatsigAvailable) {
  console.log("Using dynamic config from Statsig");
}

// Values automatically include Statsig overrides
// Statsig SDK refreshes in background - get() returns latest values within the sync delay
const limit = config.get("rateLimitPerMinute");

// For experimentation, pass user context at evaluation time
// Different users can get different config values
const userLimit = config.get("rateLimitPerMinute", { userID: "user123" });
```

### Direct Statsig Client Access

For feature gates, experiments, and other Statsig features beyond dynamic config:

```typescript
const config = new AppConfig({
  schema,
  statsig: { secretKey: process.env.STATSIG_SECRET_KEY! },
});

await config.initialize();

// Access the underlying Statsig client directly
const statsig = config.statsig;
if (statsig) {
  // Create user context for evaluation
  const user = { userID: "user123", email: "user@example.com" };

  // Feature gates
  const showNewFeature = statsig.checkGate(user, "new_feature_gate");

  // Experiments
  const experiment = statsig.getExperiment(user, "button_color_experiment");
  const buttonColor = experiment.get("color", "blue");

  // Layers
  const layer = statsig.getLayer(user, "my_layer");
  const value = layer.get("param_name", "default");

  // Log custom events
  statsig.logEvent(user, "purchase", "sku_123", { price: 9.99 });
}
```

### Config File Examples

**appconfig/config.json** (base config):

```json
{
  "port": 3000,
  "debug": false,
  "database": {
    "host": "localhost",
    "port": 5432
  }
}
```

**appconfig/config.development.json** (development overrides):

```json
{
  "debug": true
}
```

**appconfig/config.production.json** (production overrides):

```json
{
  "port": 80,
  "database": {
    "host": "db.example.com"
  }
}
```

### With Fastify

```typescript
import { AppConfig } from "@posium/appconfig";
import { z } from "zod";
import fp from "fastify-plugin";

const configSchema = z.object({
  rateLimitPerMinute: z.number().default(100),
  corsOrigins: z.array(z.string()).default(["http://localhost:3000"]),
});

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig<typeof configSchema>;
  }
}

export default fp(async (fastify) => {
  const config = new AppConfig({
    schema: configSchema,
    // environment auto-detected from NODE_ENV
    // statsig secretKey defaults to STATSIG_SECRET_KEY env var
    statsig: {},
  });

  await config.initialize();

  fastify.decorate("config", config);

  fastify.addHook("onClose", async () => {
    await config.shutdown();
  });
});

// Usage in routes
fastify.get("/settings", async () => {
  return {
    rateLimit: fastify.config.get("rateLimitPerMinute"),
  };
});
```

## API Reference

### `new AppConfig(options)`

Creates a new AppConfig instance.

| Option        | Type             | Required | Description                                                  |
| ------------- | ---------------- | -------- | ------------------------------------------------------------ |
| `schema`      | `z.ZodObject`    | Yes      | Zod schema defining config structure and defaults            |
| `configDir`   | `string`         | No       | Directory containing config files (default: `"./appconfig"`) |
| `environment` | `string`         | No       | Environment name (default: `NODE_ENV` or `"development"`)    |
| `statsig`     | `StatsigOptions` | No       | Statsig configuration for dynamic config                     |

### `StatsigOptions`

| Option       | Type      | Required | Description                                                           |
| ------------ | --------- | -------- | --------------------------------------------------------------------- |
| `secretKey`  | `string`  | No       | Statsig server secret key (default: `process.env.STATSIG_SECRET_KEY`) |
| `configName` | `string`  | No       | Dynamic Config name (default: `"app_config"`)                         |
| `localMode`  | `boolean` | No       | Enable offline mode for testing (default: `false`)                    |

### Instance Properties

| Property             | Type                    | Description                                                  |
| -------------------- | ----------------------- | ------------------------------------------------------------ |
| `currentEnvironment` | `string`                | The normalized environment being used                        |
| `configFiles`        | `readonly string[]`     | List of config files that were loaded                        |
| `isStatsigAvailable` | `boolean`               | Whether Statsig is active                                    |
| `statsig`            | `StatsigClient \| null` | Direct access to Statsig client for gates, experiments, etc. |

### Instance Methods

| Method            | Returns         | Description                                                                                                                |
| ----------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `initialize()`    | `Promise<void>` | Initialize config (required before use)                                                                                    |
| `get(key, user?)` | `T`             | Get type-safe config value by key. Pass `user` for experimentation.                                                        |
| `getAll(user?)`   | `Config`        | Get entire config object. Pass `user` for experimentation.                                                                 |
| `shutdown()`      | `Promise<void>` | Cleanup Statsig connection. After shutdown, `get()`/`getAll()` throw `NotInitializedError`. Call `initialize()` to re-use. |

### Errors

| Error                   | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `NotInitializedError`   | Thrown when `get()` called before `initialize()` |
| `ConfigFileError`       | Thrown when config file cannot be read/parsed    |
| `ConfigValidationError` | Thrown when config fails Zod validation          |
| `StatsigInitError`      | Thrown when Statsig initialization fails         |

## Statsig Setup

1. Create a [Statsig account](https://statsig.com/)
2. Create a **Dynamic Config** in the Statsig console
3. Add your config keys matching your schema
4. Use the server secret key in your application

Example Statsig Dynamic Config:

```json
{
  "rateLimitPerMinute": 200,
  "features": {
    "darkMode": true
  }
}
```

## License

MIT
