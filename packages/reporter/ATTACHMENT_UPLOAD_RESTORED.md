# Attachment Upload - Restored & Enhanced

## Status: ✅ RESTORED

The attachment upload functionality has been **restored** and integrated with the new three-hook reporting architecture.

Date: October 19, 2025

---

## How It Works

### 1. **Test Execution Phase**
- Tests run and generate attachments (screenshots, traces, videos)
- Attachments are stored in test results internally
- No uploads happen during test execution

### 2. **onEnd - Upload Phase**
Before sending the final report:

```typescript
async onEnd(result: FullResult) {
  // 1. Upload attachments
  await this.uploadAttachments();  // ← Uploads to S3/Wasabi

  // 2. Send complete report (now with attachment URLs)
  const report = this.buildRunReport('onEnd', result);
  await this.sendReport(report);
}
```

### 3. **Upload Process**

#### Step 1: Collect Attachments
- Iterates through all test results (including retries)
- Filters attachments based on configuration:
  - `reportScreenshots` - Include/exclude screenshots
  - `reportTraces` - Include/exclude trace files
  - `reportVideos` - Include/exclude videos

#### Step 2: Get Credentials
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

#### Step 3: Upload Files
- Uploads each attachment to S3/Wasabi using presigned POST
- Files are stored at: `test-results/{runId}/{testId}/{filename}`
- Updates attachment objects with remote URLs

#### Step 4: Send Report
- Final report includes attachment URLs
- Backend can access files via S3/Wasabi URLs

---

## Configuration Options

### `reportScreenshots` (default: `true`)
```typescript
reporter: [
  ['@posium/reporter', {
    reportScreenshots: false  // Skip screenshot uploads
  }]
]
```

### `reportTraces` (default: `true`)
```typescript
reporter: [
  ['@posium/reporter', {
    reportTraces: false  // Skip trace uploads (saves time/storage)
  }]
]
```

### `reportVideos` (default: `true`)
```typescript
reporter: [
  ['@posium/reporter', {
    reportVideos: false  // Skip video uploads (saves lots of storage)
  }]
]
```

### Disable All Uploads
```typescript
reporter: [
  ['@posium/reporter', {
    reportScreenshots: false,
    reportTraces: false,
    reportVideos: false  // Fastest - no uploads
  }]
]
```

When all uploads are disabled, the reporter skips requesting credentials entirely.

---

## API Endpoints Required

Your backend needs to implement **2 endpoints**:

### 1. POST `/credentials` - Get Upload Credentials
Returns presigned POST credentials for S3/Wasabi uploads.

**Request:**
```json
{
  "runId": "run_abc123"
}
```

**Response:**
```json
{
  "url": "https://s3.amazonaws.com/your-bucket",
  "fields": {
    "key": "test-results/run_abc123/",
    "AWSAccessKeyId": "...",
    "policy": "...",
    "signature": "...",
    "Content-Type": "multipart/form-data"
  }
}
```

### 2. POST `/` - Receive Run Report
Receives the complete run report with attachment URLs.

**Request:**
```json
{
  "hook": "onEnd",
  "framework": "playwright",
  "runId": "run_abc123",
  "suite": {
    "tests": [{
      "results": [{
        "attachments": [{
          "name": "screenshot.png",
          "path": "/local/path/screenshot.png",
          "url": "https://s3.../test-results/run_abc123/test_123/screenshot.png",
          "contentType": "image/png"
        }]
      }]
    }]
  }
}
```

---

## Attachment Types

The reporter automatically detects and classifies attachments:

| Type | Detection | Configurable Via |
|------|-----------|------------------|
| **Screenshots** | `image/*` content type, "screenshot" in name | `reportScreenshots` |
| **Traces** | `.zip` extension, "trace" in name/path | `reportTraces` |
| **Videos** | `video/*` content type, `.webm` extension | `reportVideos` |
| **Other** | Anything else | Always uploaded |

---

## S3/Wasabi Structure

Attachments are uploaded with the following key structure:

```
test-results/
  {runId}/
    {testId}/
      screenshot.png
      trace.zip
      video.webm
```

Example:
```
test-results/
  run_g1deyn5wxbw2wuun4b7i/
    test-abc123/
      test-failed-1.png
      trace.zip
      video-1.webm
    test-def456/
      test-failed-1.png
```

---

## Error Handling

### Upload Failures
- Individual upload failures are logged but don't fail the test run
- Reporter continues with remaining attachments
- Upload summary is logged at the end

### Credentials Failure
- If credentials endpoint fails, uploads are skipped
- Error is logged
- Test run continues and report is sent (without URLs)

### Network Issues
- Upload failures are caught and logged
- Reporter continues with next attachment
- Final report includes only successfully uploaded attachment URLs

---

## Testing with webhook.site

**Note:** webhook.site doesn't have a `/credentials` endpoint, so attachment uploads will fail gracefully.

To test with webhook.site:
```typescript
reporter: [
  ['@posium/reporter', {
    reportingApiBaseUrl: 'https://webhook.site/your-id',
    reportScreenshots: false,  // Disable uploads for webhook.site testing
    reportTraces: false,
    reportVideos: false
  }]
]
```

Or let it fail gracefully:
```typescript
// Uploads will fail (no /credentials endpoint)
// But report will still be sent successfully
reporter: [
  ['@posium/reporter', {
    reportingApiBaseUrl: 'https://webhook.site/your-id'
  }]
]
```

---

## Migration Notes

If you were using the old reporter:

### ✅ What Stayed the Same
- Attachment upload configuration options
- Presigned URL mechanism
- S3/Wasabi upload process
- Attachment filtering logic

### 🔄 What Changed
- **Timing**: Uploads now happen in `onEnd` instead of incrementally
- **Batching**: All attachments uploaded together
- **Report Structure**: Attachments now in complete RunReport

### 🎁 What's New
- All fields captured (see COMPLETE_FIELD_COVERAGE.md)
- Better error handling for uploads
- Upload summary statistics
- Graceful degradation if uploads fail

---

## Code Example

Here's how attachments flow through the reporter:

```typescript
// 1. Test generates attachment
test('example', async ({ page }) => {
  await page.screenshot({ path: 'screenshot.png' });  // Attachment created
});

// 2. onTestEnd - Attachment stored
async onTestEnd(test: TestCase, result: TestResult) {
  // result.attachments contains the screenshot
  this.testCases.get(test.id).results.push(result);  // Stored internally
}

// 3. onEnd - Attachments uploaded
async onEnd(result: FullResult) {
  await this.uploadAttachments();  // Uploads to S3/Wasabi
  // Now result.attachments[0].url = "https://s3.../screenshot.png"

  await this.sendReport(report);  // Report includes URLs
}
```

---

## Performance Considerations

### Upload Time
- Screenshots: ~100KB each, ~100ms upload
- Traces: ~1-5MB each, ~500ms-2s upload
- Videos: ~5-50MB each, ~2-20s upload

### Optimization Tips
1. Disable traces/videos if not needed
2. Use `screenshot: 'only-on-failure'` in Playwright config
3. Use `trace: 'retain-on-failure'` in Playwright config
4. Implement parallel uploads in your backend

---

## Summary

✅ **Attachment upload logic fully restored**
✅ **Integrated with three-hook architecture**
✅ **All original configuration options supported**
✅ **Enhanced error handling**
✅ **Graceful degradation**

The reporter now provides the **best of both worlds**:
- Consolidated reporting (2-3 API calls)
- Complete data capture (100% field coverage)
- Attachment uploads to S3/Wasabi
- URLs included in final report

🚀 **Ready for production!**

