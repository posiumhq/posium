# Playwright Reporter E2E Tests

End-to-end tests that verify the Playwright reporter functionality with the reporting API.

## Prerequisites

1. **Reporting API running**:
   ```bash
   cd apps/reporting
   pnpm dev
   ```

2. **Environment variables set**:
   ```bash
   # Server key for authentication (must match reporting API's expected key)
   export SERVER_KEY="your-server-key"

   # Optional: Pre-set run ID (auto-generated if not provided)
   export RUN_ID="run_test123"
   ```

## Running the Tests

### Build the reporter first

```bash
cd packages/reporter
pnpm build
```

### Run the tests

```bash
pnpm test:e2e
```

## What Gets Tested

The e2e tests include:

1. **Passing test** - Verifies successful test reporting
2. **Passing test (another)** - Tests multiple passing tests
3. **Flaky test** - Tests retry handling (fails on first attempt, passes on retry)
4. **Failing test** - Tests error reporting

## Expected Output

You should see reporter logs like:

```
👟 Initializing Playwright reporter with RUN_ID run_abc123...
📡 Reporting API: http://localhost:3002
🔑 Server Key: ***key (or "Not configured")
📎 Attachment settings: screenshots=true, traces=false, videos=false
🚀 Starting test run: run_abc123...
📤 Sending onBegin report to API...
✅ Successfully sent onBegin report
...
📤 Sending onEnd report to API...
✅ Successfully sent onEnd report
```

## Troubleshooting

### "Unauthorized" or "Invalid server key"

- Verify `SERVER_KEY` is set correctly
- Ensure the reporting API validates the `x-server-key` header

### "Connection refused"

- Ensure the reporting API is running on http://localhost:3002
- Check `playwright.config.ts` has the correct `reportingApiBaseUrl`

### Tests pass but no reports show up

- Check the reporting API logs for errors
- Verify the database is accessible
- Run migrations: `cd packages/db && pnpm db:migrate`

## Configuration

The test configuration is in `playwright.config.ts`:

```typescript
reporter: [
  ['list'],
  ['./dist/index.js', {
    reportingApiBaseUrl: 'http://localhost:3002',
    runId: process.env.RUN_ID,          // Optional - auto-generated if not set
    serverKey: process.env.SERVER_KEY,  // Server key for authentication
    reportScreenshots: true,
    reportTraces: false,
    reportVideos: false,
    logLevel: 3,
  }],
],
```

## Test Files

- `example.spec.ts` - Contains 4 tests demonstrating different scenarios
- Each test navigates to playwright.dev to generate realistic test data
- Tests are configured with `retries: 2` to demonstrate retry handling
