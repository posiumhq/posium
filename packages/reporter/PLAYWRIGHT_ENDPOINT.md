# Playwright Report Endpoint

## Overview

Added a new endpoint to the reporting API to receive Playwright test reports from the `@posium/reporter` package.

**Date**: October 19, 2025

---

## Endpoint Details

### **POST /playwright/report**

Receives consolidated test run reports from the Playwright reporter.

**URL**: `http://localhost:3002/playwright/report` (development)

**Method**: `POST`

**Content-Type**: `application/json`

---

## Request Body

The endpoint accepts a `RunReport` object with the following structure:

```typescript
{
  hook: 'onBegin' | 'onEnd' | 'onError',
  framework: 'playwright',
  runId: string,
  gitInfo?: {
    repository?: string,
    branch?: string,
    commitSha?: string,
    commitMessage?: string,
    commitAuthor?: string,
    commitAuthorEmail?: string,
    commitDate?: string,
    isDirty?: boolean,
    remoteUrl?: string,
  },
  config?: {
    // SerializableConfig - test configuration
    workers: number,
    projects: Array<...>,
    // ... more fields
  },
  suite?: {
    // SerializableSuite - test suite hierarchy
    tests: Array<{
      id: string,
      title: string,
      results: Array<{
        retry: number,
        status: string,
        duration: number,
        // ... more fields
      }>,
      // ... more fields
    }>,
    // ... more fields
  },
  runStatus?: 'passed' | 'failed' | 'timedout' | 'interrupted',
  startTime?: string,
  duration?: number,
  error?: {
    message?: string,
    stack?: string,
    value?: string,
  },
  reportedAt: string,
}
```

---

## Response

### Success (200 OK)

```json
{
  "success": true,
  "message": "Playwright onBegin report received",
  "runId": "run_abc123..."
}
```

### Validation Error (400 Bad Request)

```json
{
  "error": "Invalid request body",
  "details": [
    {
      "path": ["hook"],
      "message": "Invalid enum value..."
    }
  ]
}
```

### Server Error (500 Internal Server Error)

```json
{
  "error": "Failed to process Playwright report"
}
```

---

## Implementation

### Files Created/Modified

1. **`apps/reporting/src/handlers/playwright.ts`** - New handler
   - Validates incoming reports using Zod schema
   - Logs report details based on hook type
   - Returns success/error responses

2. **`apps/reporting/src/server.ts`** - Updated
   - Added import for `playwrightReportHandler`
   - Registered `POST /playwright/report` route

3. **`packages/playwright-reporter/playwright.config.ts`** - Updated
   - Changed `webhookUrl` from webhook.site to local endpoint
   - Now points to `http://localhost:3002/playwright/report`

---

## Logging

The handler logs detailed information based on the hook type:

### onBegin
```
📊 Received Playwright report
🚀 Test run starting
  - runId: run_abc123...
  - workers: 5
  - projects: 1
  - totalTests: 4
```

### onEnd
```
📊 Received Playwright report
🏁 Test run completed
  - runId: run_abc123...
  - status: failed
  - duration: 15000ms
  - totalTests: 4
  - totalResults: 7 (including retries)
  - passed: 3
  - failed: 4
  - skipped: 0
```

### onError
```
📊 Received Playwright report
❌ Test run error
  - runId: run_abc123...
  - errorMessage: "Global error message"
  - errorStack: "Error: ..."
```

---

## Testing

### Manual Test

1. Start the reporting server:
   ```bash
   cd apps/reporting
   pnpm run dev
   ```

2. Run Playwright tests:
   ```bash
   cd packages/playwright-reporter
   pnpm run test:e2e
   ```

3. Observe server logs for incoming reports

### Test Results

✅ **onBegin report** received successfully
- Logged configuration and git info
- Logged total test count

✅ **onEnd report** received successfully
- Logged run status and duration
- Logged test statistics (passed, failed, skipped)
- Logged retry information

✅ **Attachment uploads** working
- 11 attachments uploaded successfully
- Attachments include screenshots and error context files

---

## Example Log Output

```
INFO: 📊 Received Playwright report
  hook: 'onBegin'
  runId: 'run_xll1vsz2w16uubmfqno3'
  framework: 'playwright'
  gitBranch: 'main'
  gitCommit: '7f837f7'

INFO: 🚀 Test run starting
  runId: 'run_xll1vsz2w16uubmfqno3'
  workers: 5
  projects: 1
  totalTests: 4

INFO: 📊 Received Playwright report
  hook: 'onEnd'
  runId: 'run_xll1vsz2w16uubmfqno3'
  runStatus: 'failed'
  duration: 15000

INFO: 🏁 Test run completed
  runId: 'run_xll1vsz2w16uubmfqno3'
  status: 'failed'
  duration: 15000
  totalTests: 4
  totalResults: 7
  passed: 3
  failed: 4
  skipped: 0
```

---

## Next Steps

### Phase 1: Current State ✅
- [x] Endpoint created and validated
- [x] Logging implemented
- [x] Reporter configured to use endpoint
- [x] End-to-end testing successful

### Phase 2: Database Storage (To Do)
- [ ] Design database schema for Playwright reports
- [ ] Create migrations
- [ ] Implement database storage in handler
- [ ] Store test results, steps, attachments
- [ ] Handle retries and flaky tests

### Phase 3: API Extensions (To Do)
- [ ] Add GET endpoints to retrieve reports
- [ ] Add filtering by runId, status, date range
- [ ] Add aggregation/statistics endpoints
- [ ] Add webhook notifications for test completion

---

## Configuration

### Reporter Configuration

```typescript
// playwright.config.ts
reporter: [
  ['@posium/reporter', {
    reportingApiBaseUrl: 'http://localhost:3002',  // Reporting API base URL
    reportScreenshots: true,
    reportTraces: false,
    reportVideos: false,
    logLevel: 3,
  }]
]
```

**Note**: The reporter automatically sends reports to `{reportingApiBaseUrl}/playwright/report` and fetches credentials from `{reportingApiBaseUrl}/credentials`.

### Environment Variables

```bash
# Reporting API
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=posium-test-results
```

---

## Notes

- The endpoint currently **logs reports only** (no database storage)
- All validation is done via Zod schema
- The handler gracefully handles errors and returns appropriate status codes
- Supports all three hooks: `onBegin`, `onEnd`, `onError`
- Compatible with the three-hook consolidated reporting architecture

