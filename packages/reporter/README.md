# @posium/reporter

A custom Playwright reporter that sends comprehensive test run reports to a reporting API endpoint.

## Features

- 📊 Comprehensive run reporting with complete test execution data
- 🎯 Three-hook reporting: onBegin, onEnd, onError
- 📝 Detailed step-by-step test execution tracking
- 🔄 Retry handling - captures all retry attempts per test
- 🌐 Browser context information capture
- 📚 Git information capture (repository, branch, commit, author)
- 📦 Complete suite and config serialization
- ⚡ Configurable reporting API endpoint
- 🪵 Configurable logging levels (silent to trace)

## Installation

```bash
npm install @posium/reporter
# or
pnpm add @posium/reporter
```

## Quick Start

Add the reporter to your `playwright.config.ts`:

```typescript
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: [
    ['list'], // Keep the default list reporter for console output
    ['@posium/reporter', {
      // Configuration options go here
      reportingApiBaseUrl: 'http://localhost:3002',
      logLevel: 3, // Info level (default: 3)
    }],
  ],
  use: {
    // Enable traces and screenshots
    trace: 'on',
    screenshot: 'on',
  },
};

export default config;
```

## Configuration Options

The reporter accepts the following configuration options in the Playwright config:

### `reportingApiBaseUrl` (optional)

The base URL for the reporting API. This is used to:
- Send run reports to `{reportingApiBaseUrl}/playwright/report`
- Get S3/Wasabi upload credentials from `{reportingApiBaseUrl}/credentials`

- **Type**: `string`
- **Default**: `http://localhost:3002`
- **Required**: No

Override this with your actual reporting API base URL.

### `reportScreenshots` (optional)

Controls whether screenshots should be uploaded to S3/Wasabi.

- **Type**: `boolean`
- **Default**: `true`
- **Required**: No

Set to `false` to skip uploading screenshots, which can speed up test runs and reduce storage costs.

### `reportTraces` (optional)

Controls whether trace files should be uploaded to S3/Wasabi.

- **Type**: `boolean`
- **Default**: `true`
- **Required**: No

Set to `false` to skip uploading trace files. Traces can be large, so disabling them can significantly reduce upload time and storage usage.

### `reportVideos` (optional)

Controls whether video recordings should be uploaded to S3/Wasabi.

- **Type**: `boolean`
- **Default**: `true`
- **Required**: No

Set to `false` to skip uploading video recordings, which are typically the largest attachments.

> **Performance Note**: If all three attachment options (`reportScreenshots`, `reportTraces`, `reportVideos`) are set to `false`, the reporter will skip requesting upload credentials entirely, making test runs faster.

### `logLevel` (optional)

Controls the verbosity of the reporter's logging output using [consola](https://github.com/unjs/consola) log levels.

- **Type**: `number`
- **Default**: `3` (info level)
- **Required**: No

Available log levels:
- `0` - Silent: No logs
- `1` - Error: Only errors
- `2` - Warn: Warnings and errors
- `3` - Info: General information, warnings, and errors (default)
- `4` - Debug: Detailed debugging information
- `5` - Trace: Very detailed trace information (includes all step updates)

**Example:**
```typescript
reporter: [
  ['@posium/reporter', {
    reportingApiBaseUrl: 'http://localhost:3002',
    logLevel: 2, // Only show warnings and errors
  }],
],
```

Set to `0` for silent mode (no reporter logs), or `5` for maximum verbosity during debugging.

## Usage Examples

### Production Configuration

```typescript
reporter: [
  ['@posium/reporter', {
    reportingApiBaseUrl: 'https://api.your-service.com',
    logLevel: 3, // Info level (default)
  }],
],
```

### Local Development

```typescript
reporter: [
  ['@posium/reporter', {
    reportingApiBaseUrl: 'http://localhost:3002', // Point to local API
    logLevel: 4, // Debug level for more details
  }],
],
```

### Testing with a Mock Server

For testing, you can use tools like [webhook.site](https://webhook.site) or run a local mock server:

```typescript
reporter: [
  ['@posium/reporter', {
    reportingApiBaseUrl: 'http://localhost:3002', // Local API or mock server
    logLevel: 3, // Info level
  }],
],
```

### Debug Mode with Maximum Logging

```typescript
reporter: [
  ['@posium/reporter', {
    reportingApiBaseUrl: 'http://localhost:3002',
    logLevel: 5, // Trace level - shows all logs including step updates
  }],
],
```

Use trace level logging when troubleshooting issues with the reporter.

### With Environment Variables (Optional Pattern)

You can provide configuration values however you prefer. Here's one common pattern using environment variables:

```typescript
// playwright.config.ts
reporter: [
  ['@posium/reporter', {
    reportingApiBaseUrl: process.env.REPORTING_API_URL,
    logLevel: parseInt(process.env.LOG_LEVEL || '3'),
  }],
],
```

> **Note**: How you manage and load configuration values (environment variables, config files, etc.) is entirely up to you and your project's setup.

## How It Works

The reporter uses a **three-hook architecture** that sends comprehensive reports at key lifecycle points:

### 1. **onBegin Hook**
When tests start, the reporter:
- Generates a unique run ID
- Captures git information
- Serializes the complete test configuration
- Serializes the full test suite structure (all projects, files, describes, and test cases)
- Sends the first `RunReport` with `hook: 'onBegin'`

**Report includes**: `runId`, `framework: 'playwright'`, `gitInfo`, `config`, `suite`, `startTime`

### 2. **Test Execution** (Internal State)
As tests run, the reporter accumulates data internally:
- Captures test results from each test execution
- Handles retries - stores multiple results per test with different retry indices
- Records all steps, attachments, stdout, stderr, and errors
- **Does not** make API calls during test execution

### 3. **Attachment Upload** (Before onEnd)
Before sending the final report:
- Collects all attachments from all test results
- Filters based on configuration (`reportScreenshots`, `reportTraces`, `reportVideos`)
- Requests presigned upload credentials from API (`POST /credentials`)
- Uploads attachments to S3/Wasabi using presigned URLs
- Updates attachment objects with remote URLs

### 4. **onEnd Hook**
When all tests complete, the reporter:
- Uploads all attachments to S3/Wasabi (if enabled)
- Rebuilds the suite structure with all accumulated test results
- Includes all retry attempts for each test
- Includes attachment URLs from S3/Wasabi
- Sends the complete `RunReport` with `hook: 'onEnd'`

**Report includes**: Everything from onBegin + all test results + attachment URLs + `runStatus`, `duration`

### 5. **onError Hook** (If global error occurs)
If a global error occurs:
- Sends a `RunReport` with `hook: 'onError'`
- Includes the error details
- **Does not** include partial test results (only what was captured in onBegin)

**Report includes**: `runId`, `framework`, `gitInfo`, `config`, `suite`, `error`

## RunReport Structure

Each report sent to the API has the following structure:

```typescript
interface RunReport {
  hook: 'onBegin' | 'onEnd' | 'onError';
  framework: 'playwright';
  runId: string;
  gitInfo?: GitInfo;
  config?: SerializableConfig;
  suite?: SerializableSuite; // Complete hierarchy with all test results
  runStatus?: 'passed' | 'failed' | 'timedout' | 'interrupted';
  startTime?: string;
  duration?: number;
  error?: { message?: string; stack?: string; value?: string };
  reportedAt: string;
}
```

The `suite` object contains the complete test hierarchy with all results:
- All projects, files, describes, and test cases
- Each test case includes **all retry attempts** as separate results
- Each result includes steps, attachments, stdout, stderr, and timing
- Steps are nested and include full error details

## Features in Detail

### Retry Handling

The reporter properly handles test retries:
- Each retry attempt is captured as a separate `TestResult`
- All results are stored in the test case's `results` array
- Each result has a `retry` index (0 for first attempt, 1 for first retry, etc.)
- The final report includes all retry attempts with complete details

### Browser Context Capture

The reporter captures browser context information including:
- Browser name and version
- Platform/OS
- Viewport settings

### Git Information Capture

The reporter automatically captures git repository information at the start of each test run:
- Repository name (extracted from remote URL)
- Current branch name
- Latest commit SHA (full and short)
- Commit message
- Commit author name and email
- Commit date/time
- Working directory status (clean or dirty)
- Remote URL

This information is included in all test reports, making it easy to trace test results back to specific code versions.

**Note**: If the tests are not run in a git repository, this information will be gracefully omitted from reports.

### Error Handling

- ANSI color codes are stripped from error messages for clean reporting
- Failed uploads are logged but don't fail the test run
- Missing attachments are handled gracefully
- Git information capture failures are logged but don't affect test execution

## Using Git Utilities Standalone

The reporter exports git utility functions that can be used independently:

```typescript
import {
  getGitInfo,
  getGitInfoSafe,
  getBranch,
  getCommitSha,
  getShortCommitSha,
  getCommitMessage,
  getCommitAuthor,
  getCommitAuthorEmail,
  getCommitDate,
  getRemoteUrl,
  isDirty,
  type GitInfo
} from '@posium/reporter';

// Get all git information at once
const gitInfo = getGitInfoSafe();
console.log(gitInfo);
// {
//   repository: "org/repo-name",
//   branch: "main",
//   commitSha: "abc123...",
//   commitMessage: "feat: add new feature",
//   commitAuthor: "John Doe",
//   commitAuthorEmail: "john@example.com",
//   commitDate: "2025-10-15T12:00:00Z",
//   isDirty: false,
//   remoteUrl: "https://github.com/org/repo-name"
// }

// Or get specific information
const branch = getBranch();
const commitSha = getCommitSha();
const shortSha = getShortCommitSha();
const hasChanges = isDirty();
```

### Git Utility Functions

- `getGitInfo()` - Returns comprehensive git information or null if not in a git repo
- `getGitInfoSafe()` - Same as `getGitInfo()` but with error logging
- `getBranch()` - Get current branch name
- `getCommitSha()` - Get full commit SHA
- `getShortCommitSha()` - Get short commit SHA (7 characters)
- `getCommitMessage()` - Get commit message
- `getCommitAuthor()` - Get commit author name
- `getCommitAuthorEmail()` - Get commit author email
- `getCommitDate()` - Get commit date in ISO format
- `getRemoteUrl(remote?)` - Get remote URL (default: 'origin')
- `isDirty()` - Check if working directory has uncommitted changes

All functions return `null` if the information cannot be retrieved.

## Development

### Building

```bash
npm run build
```

### Testing

Run the example tests:

```bash
npx playwright test
```

## API Endpoints

### 1. Get Upload Credentials
```bash
POST {reportingApiBaseUrl}/credentials
Content-Type: application/json

{
  "runId": "run_..."
}

Response:
{
  "url": "https://s3.amazonaws.com/bucket",
  "fields": {
    "key": "test-results/run_.../",
    "policy": "...",
    "signature": "..."
  }
}
```

### 2. Send Run Report
```bash
POST {reportingApiBaseUrl}
Content-Type: application/json

{
  "hook": "onBegin" | "onEnd" | "onError",
  "framework": "playwright",
  "runId": "run_...",
  "gitInfo": { ... },
  "config": { ... },
  "suite": {
    "tests": [{
      "results": [{
        "attachments": [{
          "name": "screenshot.png",
          "url": "https://s3.../screenshot.png",  // Added after upload
          "contentType": "image/png"
        }]
      }]
    }]
  },
  // ... other fields based on hook
}
```

You can use the local reporting API or tools like [webhook.site](https://webhook.site) to test and inspect the report structure.

## License

See the root repository for license information.

