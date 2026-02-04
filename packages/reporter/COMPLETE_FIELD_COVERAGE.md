# Complete Field Coverage - Playwright Reporter

## Overview
This document lists ALL fields captured from Playwright's Test Reporter API, ensuring comprehensive test execution data.

Last Updated: October 19, 2025

---

## ✅ TestCase Fields (All Captured)

| Field | Type | Captured | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique test ID based on file, title, and project |
| `title` | string | ✅ | Test title |
| `titlePath` | string[] | ✅ | **NEW** - Array of titles from root to this test |
| `location.file` | string | ✅ | Source file path |
| `location.line` | number | ✅ | Line number in source |
| `location.column` | number | ✅ | Column number in source |
| `expectedStatus` | string | ✅ | Expected status (passed/failed/skipped) |
| `outcome` | string | ✅ | **NEW** - Actual outcome (expected/unexpected/flaky/skipped) |
| `ok` | boolean | ✅ | **NEW** - Whether test is considered ok |
| `timeout` | number | ✅ | Test timeout in ms |
| `retries` | number | ✅ | Max retry attempts configured |
| `repeatEachIndex` | number | ✅ | **NEW** - Index for repeat-each mode |
| `tags` | string[] | ✅ | **NEW** - Test tags (@tags and from titles) |
| `annotations` | array | ✅ | Test annotations (with **location**) |
| `results` | array | ✅ | All test results (including retries) |

**Coverage: 15/15 fields (100%)**

---

## ✅ TestResult Fields (All Captured)

| Field | Type | Captured | Description |
|-------|------|----------|-------------|
| `retry` | number | ✅ | Retry attempt index (0, 1, 2...) |
| `workerIndex` | number | ✅ | Worker that ran this test |
| `parallelIndex` | number | ✅ | **NEW** - Parallel execution index |
| `status` | string | ✅ | Test status (passed/failed/timedOut/skipped) |
| `duration` | number | ✅ | Duration in milliseconds |
| `startTime` | Date | ✅ | Test start time (ISO string) |
| `error` | object | ✅ | First error (enhanced with location, snippet, cause) |
| `errors` | array | ✅ | **NEW** - ALL errors thrown during test |
| `attachments` | array | ✅ | Test attachments (screenshots, traces, etc.) |
| `annotations` | array | ✅ | **NEW** - Result-level annotations |
| `steps` | array | ✅ | All test steps (with full hierarchy) |
| `stdout` | array | ✅ | Standard output |
| `stderr` | array | ✅ | Standard error |

**Coverage: 13/13 fields (100%)**

---

## ✅ TestStep Fields (All Captured)

| Field | Type | Captured | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Step title |
| `titlePath` | string[] | ✅ | **NEW** - Array of titles from root step to this |
| `category` | string | ✅ | Step category (expect/fixture/hook/pw:api/test.step) |
| `startTime` | Date | ✅ | Step start time (ISO string) |
| `duration` | number | ✅ | Step duration in milliseconds |
| `error` | object | ✅ | Error if step failed (enhanced with location, snippet, cause) |
| `location` | object | ✅ | **NEW** - Source location where step is defined |
| `annotations` | array | ✅ | **NEW** - Step-level annotations |
| `attachments` | array | ✅ | **NEW** - Step-level attachments |
| `steps` | array | ✅ | Nested child steps (recursive) |

**Coverage: 10/10 fields (100%)**

---

## ✅ TestError Fields (Enhanced)

| Field | Type | Captured | Description |
|-------|------|----------|-------------|
| `message` | string | ✅ | Error message (ANSI stripped) |
| `stack` | string | ✅ | Error stack trace (ANSI stripped) |
| `value` | string | ✅ | Value thrown if not an Error |
| `location` | object | ✅ | **NEW** - Error location (file/line/column) |
| `snippet` | string | ✅ | **NEW** - Code snippet with highlighted error |
| `cause` | object | ✅ | **NEW** - Error cause chain (recursive) |

**Coverage: 6/6 fields (100%)**

---

## ✅ Annotation Fields (Enhanced)

| Field | Type | Captured | Description |
|-------|------|----------|-------------|
| `type` | string | ✅ | Annotation type (skip/fail/fixme) |
| `description` | string | ✅ | Optional description |
| `location` | object | ✅ | **NEW** - Source location (file/line/column) |

**Coverage: 3/3 fields (100%)**

---

## ✅ Attachment Fields

| Field | Type | Captured | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Attachment name |
| `contentType` | string | ✅ | MIME type (image/png, application/zip) |
| `path` | string | ✅ | Filesystem path to file |
| `body` | Buffer | ✅ | **Note:** Captured but not serialized to JSON |
| `url` | string | ✅ | URL (if uploaded) |

**Coverage: 5/5 fields (100%)**

---

## 📊 Summary Statistics

### Overall Field Coverage
- **TestCase**: 15/15 fields ✅ **100%**
- **TestResult**: 13/13 fields ✅ **100%**
- **TestStep**: 10/10 fields ✅ **100%**
- **TestError**: 6/6 fields ✅ **100%**
- **Annotation**: 3/3 fields ✅ **100%**
- **Attachment**: 5/5 fields ✅ **100%**

### Total: 52/52 fields captured ✅ **100% Coverage**

---

## 🎯 Key Improvements Made

### 1. **Test Case Enhancements**
- ✅ Added `titlePath()` - Full path from root to test
- ✅ Added `outcome()` - Identifies flaky tests
- ✅ Added `ok()` - Boolean test ok status
- ✅ Added `tags` - Test tags for filtering
- ✅ Added `repeatEachIndex` - Repeat-each mode tracking
- ✅ Enhanced annotations with `location`

### 2. **Test Result Enhancements**
- ✅ Added `parallelIndex` - Parallel execution tracking
- ✅ Added `errors` array - ALL errors, not just first
- ✅ Added `annotations` - Result-level annotations
- ✅ Enhanced error with `location`, `snippet`, `cause`

### 3. **Test Step Enhancements**
- ✅ Added `titlePath()` - Full step hierarchy
- ✅ Added `location` - Source location
- ✅ Added `annotations` - Step-level annotations
- ✅ Added `attachments` - Step-level attachments
- ✅ Enhanced error with full error chain

### 4. **Error Object Enhancements**
- ✅ Added `location` - Error source location
- ✅ Added `snippet` - Code snippet with error
- ✅ Added `cause` - Recursive error cause chain

---

## 📋 Example Report Structure

```json
{
  "hook": "onEnd",
  "framework": "playwright",
  "runId": "run_...",
  "gitInfo": { ... },
  "config": { ... },
  "suite": {
    "tests": [{
      "id": "test-id",
      "title": "flaky test - passes on retry",
      "titlePath": ["", "Playwright Website Tests", "flaky test - passes on retry"],
      "outcome": "flaky",
      "ok": true,
      "tags": ["@smoke", "critical"],
      "repeatEachIndex": 0,
      "annotations": [{
        "type": "slow",
        "description": "Known to be slow",
        "location": { "file": "test.spec.ts", "line": 10, "column": 5 }
      }],
      "results": [
        {
          "retry": 0,
          "status": "failed",
          "workerIndex": 0,
          "parallelIndex": 0,
          "error": {
            "message": "Expected 2, received 1",
            "stack": "...",
            "location": { "file": "test.spec.ts", "line": 30, "column": 17 },
            "snippet": "29:  console.log(...);\n30:  expect(1).toBe(2);\n      ^^^^^^^^^^",
            "cause": null
          },
          "errors": [
            { "message": "...", "location": {...} }
          ],
          "annotations": [...],
          "steps": [{
            "title": "expect.toBe",
            "titlePath": ["Before Hooks", "beforeEach hook", "expect.toBe"],
            "category": "expect",
            "location": { "file": "test.spec.ts", "line": 30, "column": 7 },
            "annotations": [],
            "attachments": [],
            "error": {...},
            "steps": []
          }],
          "attachments": [
            { "name": "screenshot", "path": "...", "contentType": "image/png" }
          ],
          "stdout": ["First attempt - intentionally failing"],
          "stderr": []
        },
        {
          "retry": 1,
          "status": "passed",
          "workerIndex": 0,
          "parallelIndex": 0,
          "error": null,
          "errors": [],
          "steps": [...],
          "stdout": ["Retry attempt 1 - passing"],
          "stderr": []
        }
      ]
    }]
  },
  "runStatus": "failed",
  "duration": 38000,
  "reportedAt": "2025-10-19T..."
}
```

---

## 🔍 What This Enables

### For Analysis
- **Flakiness Detection**: `outcome: "flaky"` field instantly identifies flaky tests
- **Parallel Execution Tracking**: `parallelIndex` shows concurrent test execution
- **Error Source Tracing**: `error.location` and `error.snippet` pinpoint failures
- **Error Cause Chains**: Recursive `cause` field tracks error origins
- **Step-Level Details**: Complete step hierarchy with locations and errors
- **Tag-Based Filtering**: Filter and organize tests by tags

### For Debugging
- **Source Locations**: Every test, step, annotation, and error has source location
- **Code Snippets**: Error snippets show exact failing code
- **Full Error Chains**: Trace errors through causes
- **Step Attachments**: See what was attached at each step
- **Title Paths**: Understand test/step hierarchy

### For Reporting
- **Complete Test History**: All retry attempts with full details
- **Annotation Tracking**: Track skips, fails, and custom annotations
- **Tag-Based Reports**: Generate reports by test tags
- **Worker Distribution**: Analyze test distribution across workers
- **Outcome Categorization**: Group tests by outcome (expected/unexpected/flaky)

---

## ✅ Verification

You can verify all fields are captured by checking the webhook at:
https://webhook.site/a7bcd5b1-53a6-4868-a0c3-03e23638fbc2

The report will show:
- ✅ All test case fields including titlePath, outcome, ok, tags
- ✅ All result fields including parallelIndex, errors array, annotations
- ✅ All step fields including titlePath, location, annotations, attachments
- ✅ Enhanced error objects with location, snippet, and cause chains
- ✅ Complete annotation objects with locations

---

## 📚 References

- [Playwright TestCase API](https://playwright.dev/docs/api/class-testcase)
- [Playwright TestResult API](https://playwright.dev/docs/api/class-testresult)
- [Playwright TestStep API](https://playwright.dev/docs/api/class-teststep)
- [Playwright Reporter API](https://playwright.dev/docs/api/class-reporter)

---

**Status: Complete ✅**
**Coverage: 100%**
**Last Updated: October 19, 2025**

