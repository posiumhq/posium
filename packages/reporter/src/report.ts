import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import type { createConsola } from 'consola';

/** Maximum number of concurrent file uploads to prevent overwhelming the server */
const MAX_CONCURRENT_UPLOADS = 6;

/** Current number of active uploads being processed */
let activeUploads = 0;

/**
 * Waits for an available upload slot to prevent exceeding the maximum concurrent uploads.
 * Uses recursive polling with a 100ms delay until a slot becomes available.
 *
 * @returns Promise that resolves when an upload slot is available
 */
async function waitForUploadSlot(): Promise<void> {
  if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
    return waitForUploadSlot();
  }
  activeUploads++;
}

/**
 * Releases an upload slot after an upload completes or fails.
 * Decrements the active upload counter to allow other uploads to proceed.
 */
function releaseUploadSlot(): void {
  activeUploads--;
}

/**
 * AWS S3 presigned POST structure containing upload URL and required form fields
 * @internal
 */
interface PresignedPost {
  /** The S3 endpoint URL to POST the file to */
  url: string;
  /** Form fields required for the presigned POST (key, policy, signature, etc.) */
  fields: Record<string, string>;
}

/**
 * Makes an HTTP/HTTPS request using native Node.js modules.
 * Automatically handles both HTTP and HTTPS protocols based on the URL.
 *
 * @param url - Full URL to make the request to
 * @param method - HTTP method (GET, POST, PATCH, etc.)
 * @param data - Optional data to send as JSON in the request body
 * @param serverKey - Optional server key for authentication (internal infrastructure key)
 * @returns Promise resolving to the parsed JSON response or raw response data
 * @throws Error if the response status code is outside the 200-299 range
 */
function makeRequest(url: string, method: string, data?: any, serverKey?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    const parsedUrl = new URL(url);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add x-server-key header for internal authentication
    if (serverKey) {
      headers['x-server-key'] = serverKey;
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers,
    };

    const req = client.request(options, res => {
      let responseData = '';

      res.on('data', chunk => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseData));
          } catch {
            resolve(responseData);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Requests AWS S3 presigned POST credentials from the reporting API.
 * These credentials are used to upload test attachments directly to S3.
 *
 * @param runId - Unique identifier for the test run
 * @param apiBaseUrl - Base URL of the reporting API
 * @param logger - Consola logger instance for logging
 * @param serverKey - Optional server key for authentication (internal infrastructure key)
 * @returns Promise resolving to presigned POST credentials (URL and form fields)
 * @throws Error if the API request fails
 */
export async function getCredentials(runId: string, apiBaseUrl: string, logger: ReturnType<typeof createConsola>, serverKey?: string): Promise<PresignedPost> {
  logger.debug('🔑 Getting upload credentials for run:', runId);
  return makeRequest(`${apiBaseUrl}/v1/credentials`, 'POST', { runId }, serverKey);
}

/**
 * Uploads a file to AWS S3 using presigned POST credentials.
 * Uses multipart/form-data encoding with proper boundary handling.
 * Respects concurrent upload limits via slot management.
 *
 * The uploaded file will be stored with the key structure: test-results/runId/testId/filename
 *
 * @param filePath - Local path to the file to upload
 * @param presignedPost - Presigned POST credentials from getCredentials()
 * @param testId - Unique identifier for the test (used in S3 key structure)
 * @param logger - Consola logger instance for logging
 * @returns Promise resolving to the public URL of the uploaded file
 * @throws Error if the upload fails or file cannot be read
 */
export async function uploadFile(
  filePath: string,
  presignedPost: PresignedPost,
  testId: string,
  logger: ReturnType<typeof createConsola>
): Promise<string> {
  await waitForUploadSlot();

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);
    const fileName = path.basename(filePath);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);

    // Get the base path from the presigned post key (should be test-results/runId/)
    const baseKeyPath = presignedPost.fields.key?.split('/').slice(0, -1).join('/');

    // Calculate the form data parts first
    const formDataStart = Object.entries({
      ...presignedPost.fields,
      // Maintain the required prefix structure: test-results/runId/testId/filename
      key: `${baseKeyPath}/${testId}/${fileName}`,
    })
      .map(
        ([key, value]) =>
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      )
      .join('');

    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const formDataEnd = `\r\n--${boundary}--\r\n`;

    // Get file size for Content-Length calculation
    const fileSize = fs.statSync(filePath).size;
    const contentLength =
      Buffer.byteLength(formDataStart) +
      Buffer.byteLength(fileHeader) +
      fileSize +
      Buffer.byteLength(formDataEnd);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': contentLength,
      },
    };

    const req = https.request(presignedPost.url, options, res => {
      let responseData = '';

      res.on('data', chunk => {
        responseData += chunk;
      });

      res.on('end', () => {
        releaseUploadSlot(); // Release slot when done
        if (res.statusCode === 204 || res.statusCode === 200) {
          // Use the same key structure for the URL
          resolve(`${presignedPost.url}/${baseKeyPath}/${testId}/${fileName}`);
        } else {
          reject(new Error(`Upload failed with status ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', error => {
      releaseUploadSlot(); // Release slot on error
      reject(error);
    });

    // Write form fields
    req.write(formDataStart);

    // Write file header
    req.write(fileHeader);

    // Pipe file content
    fileStream.pipe(req, { end: false });

    // Write form data end after file is piped
    fileStream.on('end', () => {
      req.write(formDataEnd);
      req.end();
    });

    // Handle file stream errors
    fileStream.on('error', error => {
      releaseUploadSlot(); // Release slot on file error
      req.destroy();
      reject(new Error(`File read error: ${error.message}`));
    });
  });
}

/**
 * Uploads a buffer to AWS S3 using presigned POST credentials.
 * Uses multipart/form-data encoding with proper boundary handling.
 * Respects concurrent upload limits via slot management.
 *
 * @param buffer - Buffer containing the file content
 * @param fileName - Name for the file in S3
 * @param presignedPost - Presigned POST credentials from getCredentials()
 * @param testId - Unique identifier for the test (used in S3 key structure)
 * @param logger - Consola logger instance for logging
 * @returns Promise resolving to the public URL of the uploaded file
 * @throws Error if the upload fails
 */
export async function uploadBuffer(
  buffer: Buffer,
  fileName: string,
  presignedPost: PresignedPost,
  testId: string,
  logger: ReturnType<typeof createConsola>
): Promise<string> {
  await waitForUploadSlot();

  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);

    // Get the base path from the presigned post key (should be test-results/runId/)
    const baseKeyPath = presignedPost.fields.key?.split('/').slice(0, -1).join('/');

    // Calculate the form data parts first
    const formDataStart = Object.entries({
      ...presignedPost.fields,
      // Maintain the required prefix structure: test-results/runId/testId/filename
      key: `${baseKeyPath}/${testId}/${fileName}`,
    })
      .map(
        ([key, value]) =>
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      )
      .join('');

    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const formDataEnd = `\r\n--${boundary}--\r\n`;

    // Calculate content length
    const contentLength =
      Buffer.byteLength(formDataStart) +
      Buffer.byteLength(fileHeader) +
      buffer.length +
      Buffer.byteLength(formDataEnd);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': contentLength,
      },
    };

    const req = https.request(presignedPost.url, options, res => {
      let responseData = '';

      res.on('data', chunk => {
        responseData += chunk;
      });

      res.on('end', () => {
        releaseUploadSlot(); // Release slot when done
        if (res.statusCode === 204 || res.statusCode === 200) {
          // Use the same key structure for the URL
          resolve(`${presignedPost.url}/${baseKeyPath}/${testId}/${fileName}`);
        } else {
          reject(new Error(`Upload failed with status ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', error => {
      releaseUploadSlot(); // Release slot on error
      reject(error);
    });

    // Write form fields
    req.write(formDataStart);

    // Write file header
    req.write(fileHeader);

    // Write buffer content
    req.write(buffer);

    // Write form data end
    req.write(formDataEnd);
    req.end();
  });
}

/**
 * Sends a complete run report to the reporting API endpoint.
 * This is called on onBegin, onEnd, and onError hooks.
 *
 * @param runReport - Complete run report containing all test execution data
 * @param apiBaseUrl - Base URL of the reporting API
 * @param logger - Consola logger instance for logging
 * @param serverKey - Optional server key for authentication (internal infrastructure key)
 * @returns Promise resolving when the report is sent successfully
 * @throws Error if the API request fails
 */
export async function sendRunReport(
  runReport: any,
  apiBaseUrl: string,
  logger: ReturnType<typeof createConsola>,
  serverKey?: string
): Promise<void> {
  logger.debug(`📤 Sending run report for hook: ${runReport.hook}`);
  await makeRequest(`${apiBaseUrl}/v1/playwright/report`, 'POST', runReport, serverKey);
  logger.info(`✅ Successfully sent ${runReport.hook} report`);
}
