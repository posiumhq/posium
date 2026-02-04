# Testing Guide

This package uses **Vitest** for unit tests and **Playwright** for end-to-end integration tests.

## Test Structure

```
packages/playwright-reporter/
├── src/
│   ├── __tests__/          # Unit tests
│   │   ├── index.test.ts   # Tests for main reporter class
│   │   └── report.test.ts  # Tests for report utility functions
│   ├── index.ts            # Main reporter implementation
│   ├── report.ts           # Report utility functions
│   └── types.ts
├── e2e/                    # E2E/Integration tests
│   └── example.spec.ts     # Sample test that triggers the reporter
└── vitest.config.ts        # Vitest configuration
```

## Running Tests

### Unit Tests (Vitest)

```bash
# Run unit tests once
pnpm test

# Run unit tests in watch mode
pnpm test:watch

# Run unit tests with coverage report
pnpm test:coverage
```

### E2E Tests (Playwright)

```bash
# Run E2E tests (requires build first)
pnpm build
pnpm test:e2e

# Run E2E tests in debug mode
pnpm test:e2e:debug
```

## Test Coverage

The unit test suite provides comprehensive coverage:

- **Overall Coverage**: ~84%
- **index.ts**: ~90% (main reporter class)
- **report.ts**: ~95% (utility functions)

### What's Tested

#### Unit Tests (`src/__tests__/`)

**report.test.ts** - Tests for utility functions:
- ✅ `getCredentials()` - Fetching upload credentials
  - Success cases
  - HTTP error handling
  - Network error handling
- ✅ `uploadFile()` - File upload functionality
  - Successful uploads
  - Upload failures
  - File read errors
- ✅ `createTestReport()` - Creating test reports
  - Report creation
  - Request data validation
- ✅ `updateTestReport()` - Updating test reports
  - Report updates
  - Request body structure
  - Error handling

**index.test.ts** - Tests for main reporter class:
- ✅ Constructor & initialization
  - Default options
  - Custom options
  - Run ID generation
- ✅ `onBegin()` - Test run start
- ✅ `onTestBegin()` - Individual test start
  - Report creation
  - Error handling
- ✅ `onStepBegin()` - Test step start
- ✅ `onStepEnd()` - Test step completion
  - Step data collection
  - Error handling
  - ANSI code stripping
- ✅ `onTestEnd()` - Test completion
  - Final result reporting
  - Browser context handling
  - Attachment collection
- ✅ `onEnd()` - Test run completion
  - Attachment uploads
  - Attachment filtering (screenshots/traces/videos)
  - Upload error handling
  - Configuration-based skipping
- ✅ `onError()` - Reporter error handling
- ✅ Attachment type detection
  - Screenshot identification
  - Trace identification
  - Video identification

#### E2E Tests (`e2e/`)

**example.spec.ts** - Integration test:
- Dummy Playwright tests that exercise the reporter
- Used to verify the reporter works in a real Playwright environment
- Not a unit test, but useful for manual verification

## Test Configuration

### vitest.config.ts

```typescript
{
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
}
```

### tsconfig.json

Test files are excluded from the build:
```json
{
  "exclude": ["node_modules", "dist", "src/**/*.test.ts", "src/**/__tests__", "e2e"]
}
```

## Writing New Tests

### Unit Tests

1. Create test files in `src/__tests__/` with the `.test.ts` extension
2. Use Vitest's testing utilities:
   ```typescript
   import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
   ```
3. Mock external dependencies using `vi.mock()`
4. Test both success and error cases
5. Verify function behavior with `expect()` assertions

### E2E Tests

1. Create test files in `e2e/` with the `.spec.ts` extension
2. Use Playwright's testing API:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```
3. Build the project first: `pnpm build`
4. Run tests: `pnpm test:e2e`

## Best Practices

1. **Test isolation**: Each test should be independent
2. **Mock external dependencies**: HTTP requests, file system operations
3. **Test error cases**: Don't just test the happy path
4. **Clear test names**: Describe what's being tested
5. **Setup/teardown**: Use `beforeEach`/`afterEach` for clean state
6. **Coverage goals**: Aim for >80% coverage on critical code

## Continuous Integration

The unit tests run automatically via:
```bash
pnpm test
```

This should be included in your CI/CD pipeline to catch regressions early.

