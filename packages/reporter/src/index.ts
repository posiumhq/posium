import type {
  Reporter,
  FullConfig,
  TestCase,
  TestResult,
  TestStep,
  FullResult,
  Suite,
  TestError,
} from '@playwright/test/reporter';

import { createConsola, LogLevels } from 'consola';
import { sendRunReport, getCredentials, uploadFile, uploadBuffer } from './report.js';
import { createId } from '@posium/id';
import { getGitInfo } from './git.js';
import type {
  GitInfo,
  ReporterOptions,
  RunReport,
  SerializableConfig,
  SerializableSuite,
  SerializableTestCase,
  SerializableTestResult,
  SerializableTestStep,
  Attachment,
} from './types.js';

/**
 * Removes ANSI color codes from strings (typically error messages).
 * @param str - String potentially containing ANSI escape codes
 * @returns String with ANSI codes removed
 */
const stripAnsi = (str?: string) => str?.replace(/\u001b\[\d+m/g, '');

/**
 * Custom Playwright reporter that sends comprehensive test run reports to a reporting API.
 * Reports are sent on three hooks: onBegin, onEnd, and onError.
 * Each report contains complete test execution data including config, suite, all test results, and git info.
 *
 * @example
 * ```typescript
 * // playwright.config.ts
 * export default defineConfig({
 *   reporter: [
 *     ['@posium/reporter', {
 *       reportingApiBaseUrl: 'http://localhost:3002',
 *       logLevel: 3
 *     }]
 *   ]
 * });
 * ```
 */
export default class PlaywrightReporter implements Reporter {
  /** Unique identifier for this test run session */
  private readonly runId: string;

  /** Base URL for the reporting API (used for getting S3 credentials) */
  private readonly reportingApiBaseUrl: string;

  /** Server key for authenticating with the reporting API (internal infrastructure key) */
  private readonly serverKey?: string;

  /** Whether to upload screenshot attachments */
  private readonly reportScreenshots: boolean;

  /** Whether to upload trace attachments */
  private readonly reportTraces: boolean;

  /** Whether to upload video attachments */
  private readonly reportVideos: boolean;

  /** Git repository information captured at test run start */
  private gitInfo: GitInfo | null = null;

  /** Logger instance for console output */
  private readonly logger: ReturnType<typeof createConsola>;

  /** Stored configuration from onBegin */
  private config: FullConfig | null = null;

  /** Stored root suite from onBegin */
  private suite: Suite | null = null;

  /** Run start time */
  private startTime: Date | null = null;

  /** Map of test ID to accumulated test case data with all retry results */
  private readonly testCases: Map<string, {
    test: TestCase;
    results: TestResult[];
  }> = new Map();

  /**
   * Initializes the Playwright reporter with configuration options.
   * Uses RUN_ID from env var or options, or auto-generates one.
   * Uses REPORTING_SERVER_KEY from env var or options for authentication.
   *
   * @param options - Reporter configuration options
   */
  constructor(options: ReporterOptions = {}) {
    // Use RUN_ID from options, then env var, then auto-generate
    this.runId = options.runId ?? process.env.RUN_ID ?? createId('run');
    this.reportingApiBaseUrl = options.reportingApiBaseUrl ?? 'http://localhost:3002';
    // Use serverKey from options or REPORTING_SERVER_KEY env var
    this.serverKey = options.serverKey ?? process.env.REPORTING_SERVER_KEY;
    this.reportScreenshots = options.reportScreenshots ?? true;
    this.reportTraces = options.reportTraces ?? true;
    this.reportVideos = options.reportVideos ?? true;

    // Initialize logger with configured log level (default: 3 = info)
    this.logger = createConsola({
      level: options.logLevel ?? LogLevels.info,
    });

    this.logger.info(`👟 Initializing Playwright reporter with RUN_ID ${this.runId}`);
    this.logger.info(`📡 Reporting API: ${this.reportingApiBaseUrl}`);
    this.logger.info(`🔑 Server Key: ${this.serverKey ? '***' + this.serverKey.slice(-4) : 'Not configured'}`);
    this.logger.info(`📎 Attachment settings: screenshots=${this.reportScreenshots}, traces=${this.reportTraces}, videos=${this.reportVideos}`);
  }

  /**
   * Serializes Playwright FullConfig to a plain object.
   * Extracts key configuration details for reporting.
   *
   * @param config - Playwright full configuration
   * @returns Serializable configuration object
   */
  private serializeConfig(config: FullConfig): SerializableConfig {
    this.logger.debug('📋 Serializing configuration');
    return {
      rootDir: config.rootDir,
      workers: config.workers,
      globalTimeout: config.globalTimeout,
      projects: config.projects.map(project => ({
        name: project.name,
        timeout: project.timeout,
        retries: project.retries,
        testDir: project.testDir,
        use: project.use,
      })),
      reporter: config.reporter,
    };
  }

  /**
   * Recursively serializes Playwright Suite to a plain object.
   * Includes all nested suites and test cases.
   *
   * @param suite - Playwright suite
   * @returns Serializable suite object
   */
  private serializeSuite(suite: Suite): SerializableSuite {
    this.logger.debug(`📦 Serializing suite: ${suite.title}`);
    return {
      title: suite.title,
      type: suite.type as 'project' | 'file' | 'describe',
      file: suite.location?.file,
      line: suite.location?.line,
      column: suite.location?.column,
      suites: (suite.suites || []).map(s => this.serializeSuite(s)),
      tests: (suite.tests || []).map(t => this.serializeTestCase(t)),
    };
  }

  /**
   * Serializes a Playwright TestCase to a plain object.
   * Includes all accumulated test results from retry attempts.
   *
   * @param test - Playwright test case
   * @returns Serializable test case object
   */
  private serializeTestCase(test: TestCase): SerializableTestCase {
    const testData = this.testCases.get(test.id);
    const results = testData?.results || [];

    return {
      id: test.id,
      title: test.title,
      titlePath: test.titlePath(),
      file: test.location?.file,
      line: test.location?.line,
      column: test.location?.column,
      retries: test.retries,
      expectedStatus: test.expectedStatus,
      timeout: test.timeout,
      annotations: test.annotations.map(a => ({
        type: a.type,
        description: a.description,
        location: a.location ? {
          file: a.location.file,
          line: a.location.line,
          column: a.location.column,
        } : undefined,
      })),
      outcome: test.outcome(),
      ok: test.ok(),
      tags: test.tags || [],
      repeatEachIndex: test.repeatEachIndex,
      results: results.map(r => this.serializeTestResult(r)),
    };
  }

  /**
   * Serializes a Playwright TestResult to a plain object.
   * Includes steps, attachments, stdout, stderr, and error details.
   *
   * @param result - Playwright test result
   * @returns Serializable test result object
   */
  private serializeTestResult(result: TestResult): SerializableTestResult {
    const serializeError = (error: any): any => ({
      message: stripAnsi(error.message),
      stack: stripAnsi(error.stack),
      value: error.value,
      location: error.location ? {
        file: error.location.file,
        line: error.location.line,
        column: error.location.column,
      } : undefined,
      snippet: error.snippet,
      cause: error.cause ? serializeError(error.cause) : undefined,
    });

    return {
      retry: result.retry,
      workerIndex: result.workerIndex,
      parallelIndex: result.parallelIndex,
      status: result.status,
      duration: result.duration,
      startTime: result.startTime.toISOString(),
      error: result.error ? serializeError(result.error) : undefined,
      errors: (result.errors || []).map(e => serializeError(e)),
      attachments: (result.attachments || []).map(a => this.serializeAttachment(a)),
      annotations: (result.annotations || []).map(a => ({
        type: a.type,
        description: a.description,
        location: a.location ? {
          file: a.location.file,
          line: a.location.line,
          column: a.location.column,
        } : undefined,
      })),
      steps: (result.steps || []).map(s => this.serializeTestStep(s)),
      stdout: (result.stdout || []).map(s => typeof s === 'string' ? s : s.toString()),
      stderr: (result.stderr || []).map(s => typeof s === 'string' ? s : s.toString()),
    };
  }

  /**
   * Recursively serializes a Playwright TestStep to a plain object.
   * Includes nested steps and error details.
   *
   * @param step - Playwright test step
   * @returns Serializable test step object
   */
  private serializeTestStep(step: TestStep): SerializableTestStep {
    const serializeStepError = (error: any): any => ({
      message: stripAnsi(error.message),
      stack: stripAnsi(error.stack),
      value: error.value,
      location: error.location ? {
        file: error.location.file,
        line: error.location.line,
        column: error.location.column,
      } : undefined,
      snippet: error.snippet,
      cause: error.cause ? serializeStepError(error.cause) : undefined,
    });

    return {
      title: step.title,
      titlePath: step.titlePath(),
      category: step.category,
      startTime: step.startTime.toISOString(),
      duration: step.duration,
      error: step.error ? serializeStepError(step.error) : undefined,
      location: step.location ? {
        file: step.location.file,
        line: step.location.line,
        column: step.location.column,
      } : undefined,
      annotations: (step.annotations || []).map(a => ({
        type: a.type,
        description: a.description,
        location: a.location ? {
          file: a.location.file,
          line: a.location.line,
          column: a.location.column,
        } : undefined,
      })),
      attachments: (step.attachments || []).map(a => this.serializeAttachment(a)),
      steps: (step.steps || []).map(s => this.serializeTestStep(s)),
    };
  }

  /**
   * Determines the type of an attachment based on its name, content type, and path.
   * Uses heuristics to classify attachments into screenshots, traces, videos, or other.
   *
   * @param attachment - Attachment object with name, contentType, and optional path
   * @returns The classified attachment type
   */
  private getAttachmentType(attachment: { name: string; contentType: string; path?: string }): 'screenshot' | 'trace' | 'video' | 'other' {
    const name = attachment.name.toLowerCase();
    const contentType = attachment.contentType.toLowerCase();
    const path = attachment.path?.toLowerCase() || '';

    // Check for screenshots
    if (name.includes('screenshot') || contentType.includes('image/')) {
      return 'screenshot';
    }

    // Check for traces (usually .zip files)
    if (name.includes('trace') || path.includes('trace') || path.endsWith('.zip')) {
      return 'trace';
    }

    // Check for videos
    if (name.includes('video') || contentType.includes('video/') || path.endsWith('.webm')) {
      return 'video';
    }

    return 'other';
  }

  /**
   * Determines whether an attachment should be uploaded based on reporter configuration.
   * Checks the attachment type against the configured upload settings.
   *
   * @param attachment - Attachment object to check
   * @returns True if the attachment should be uploaded, false otherwise
   */
  private shouldUploadAttachment(attachment: { name: string; contentType: string; path?: string }): boolean {
    const attachmentType = this.getAttachmentType(attachment);

    switch (attachmentType) {
      case 'screenshot':
        return this.reportScreenshots;
      case 'trace':
        return this.reportTraces;
      case 'video':
        return this.reportVideos;
      default:
        return true; // Upload other attachment types by default
    }
  }

  /**
   * Serializes a Playwright attachment to a plain object.
   *
   * @param attachment - Playwright attachment
   * @returns Serializable attachment object
   */
  private serializeAttachment(attachment: any): Attachment {
    return {
      name: attachment.name,
      path: attachment.path,
      contentType: attachment.contentType,
      url: attachment.url,
    };
  }

  /**
   * Builds a complete RunReport object with all available data.
   *
   * @param hook - Which hook is building this report
   * @param runResult - Optional FullResult from onEnd
   * @param error - Optional TestError from onError
   * @returns Complete run report object
   */
  private buildRunReport(
    hook: 'onBegin' | 'onEnd' | 'onError',
    runResult?: FullResult,
    error?: TestError
  ): RunReport {
    this.logger.debug(`🏗️  Building run report for hook: ${hook}`);

    const report: RunReport = {
      hook,
      framework: 'playwright',
      runId: this.runId,
      gitInfo: this.gitInfo || undefined,
      reportedAt: new Date().toISOString(),
    };

    // Add config and suite structure (available after onBegin)
    if (this.config) {
      report.config = this.serializeConfig(this.config);
      this.logger.debug(`📋 Added config with ${this.config.projects.length} project(s)`);
    }

    if (this.suite) {
      // Rebuild suite with accumulated test results
      report.suite = this.serializeSuite(this.suite);
      const totalTests = this.suite.allTests().length;
      const testsWithResults = this.testCases.size;
      this.logger.debug(`📦 Added suite with ${totalTests} test(s), ${testsWithResults} have results`);
    }

    // Add run-level information (available after onEnd)
    if (runResult) {
      report.runStatus = runResult.status;
      report.duration = runResult.duration;
      this.logger.debug(`⏱️  Added run status: ${runResult.status}, duration: ${runResult.duration}ms`);
    }

    // Add start time if available
    if (this.startTime) {
      report.startTime = this.startTime.toISOString();
    }

    // Add error information (from onError)
    if (error) {
      report.error = {
        message: stripAnsi(error.message),
        stack: stripAnsi(error.stack),
        value: error.value,
      };
      this.logger.debug(`❌ Added error: ${error.message}`);
    }

    return report;
  }


  /**
   * Playwright lifecycle hook called when the test run begins.
   * Captures git information, config, suite, and sends the first report.
   *
   * @param config - Playwright test configuration
   * @param suite - Root test suite containing all tests
   */
  async onBegin(config: FullConfig, suite: Suite): Promise<void> {
    this.startTime = new Date();
    this.config = config;
    this.suite = suite;

    // Capture git information at the start of the test run
    this.gitInfo = getGitInfo(this.logger);

    this.logger.start(`🚀 Starting test run: ${this.runId}`);
    this.logger.info(`📊 Configuration: ${config.workers} worker(s), ${config.projects.length} project(s)`);
    this.logger.info(`🧪 Total tests: ${suite.allTests().length}`);

    if (this.gitInfo) {
      this.logger.info(`🔀 Git branch: ${this.gitInfo.branch}`);
      this.logger.info(`📝 Git commit: ${this.gitInfo.commitSha?.substring(0, 7)}`);
    }

    // Build and send onBegin report
    const report = this.buildRunReport('onBegin');
    try {
      this.logger.info(`📤 Sending ${report.hook} report to API...`);
      await sendRunReport(report, this.reportingApiBaseUrl, this.logger, this.serverKey);
      this.logger.success(`✅ Successfully sent ${report.hook} report`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Failed to send ${report.hook} report: ${errorMessage}`);
      // Don't throw - we don't want to fail the test run if reporting fails
    }
  }

  /**
   * Playwright lifecycle hook called when an individual test begins execution.
   * No longer reports to API - just logs for debugging.
   *
   * @param test - Test case that is starting
   */
  async onTestBegin(test: TestCase): Promise<void> {
    this.logger.debug(`▶️  Starting test: ${test.title}`);
  }

  /**
   * Playwright lifecycle hook called when a test step begins.
   * No longer reports to API - just logs for debugging.
   *
   * @param test - Test case containing the step
   * @param result - Current test result
   * @param step - Test step that is starting
   */
  async onStepBegin(test: TestCase, result: TestResult, step: TestStep): Promise<void> {
    this.logger.trace(`  👉 ${step.title}`);
  }

  /**
   * Playwright lifecycle hook called when a test step completes.
   * No longer reports to API - step data is captured in the result object.
   *
   * @param test - Test case containing the step
   * @param result - Current test result
   * @param step - Test step that completed
   */
  async onStepEnd(test: TestCase, result: TestResult, step: TestStep): Promise<void> {
    const status = step.error ? '❌' : '✅';
    this.logger.trace(`  ${status} ${step.title} (${step.duration}ms)`);
  }

  /**
   * Playwright lifecycle hook called when a test completes execution.
   * Accumulates test results including all retry attempts.
   * Does not report to API - results are sent in onEnd.
   *
   * @param test - Test case that completed
   * @param result - Final test result including status, duration, steps, and attachments
   */
  async onTestEnd(test: TestCase, result: TestResult): Promise<void> {
    const statusIcon = result.status === 'passed' ? '✅' :
                       result.status === 'failed' ? '❌' :
                       result.status === 'skipped' ? '⏭️' :
                       result.status === 'timedOut' ? '⏱️' : '❓';

    this.logger.debug(
      `${statusIcon} Test finished: ${test.title} (${result.status}, retry: ${result.retry}, ${result.duration}ms)`
    );

    // Accumulate test results (handles retries)
    let testData = this.testCases.get(test.id);
    if (!testData) {
      testData = {
        test,
        results: [],
      };
      this.testCases.set(test.id, testData);
    }

    // Add this result (could be a retry)
    testData.results.push(result);

    this.logger.debug(
      `📊 Test ${test.id} now has ${testData.results.length} result(s)`
    );

    // Log detailed test information
    if (result.error) {
      this.logger.debug(`  ❌ Error: ${stripAnsi(result.error.message)?.substring(0, 100)}`);
    }
    if (result.attachments.length > 0) {
      this.logger.debug(`  📎 Attachments: ${result.attachments.length}`);
    }
    if (result.steps.length > 0) {
      this.logger.debug(`  📝 Steps: ${result.steps.length}`);
    }
  }

  /**
   * Playwright lifecycle hook called when the entire test run completes.
   * Uploads attachments to S3/Wasabi, then builds and sends complete run report.
   *
   * @param result - Final test run result including status and duration
   */
  async onEnd(result: FullResult): Promise<void> {
    this.logger.info('\n🏁 Test run completed!');
    this.logger.info(`📊 Final status: ${result.status}`);
    this.logger.info(`⏱️  Duration: ${Math.round(result.duration / 1000)}s`);
    this.logger.info(`🧪 Tests executed: ${this.testCases.size}`);

    // Count total results including retries
    let totalResults = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const testData of this.testCases.values()) {
      totalResults += testData.results.length;
      for (const result of testData.results) {
        if (result.status === 'passed') totalPassed++;
        else if (result.status === 'failed') totalFailed++;
        else if (result.status === 'skipped') totalSkipped++;
      }
    }

    this.logger.info(`📈 Total results (including retries): ${totalResults}`);
    this.logger.info(`  ✅ Passed: ${totalPassed}`);
    this.logger.info(`  ❌ Failed: ${totalFailed}`);
    this.logger.info(`  ⏭️  Skipped: ${totalSkipped}`);

    // Upload attachments before sending report
    await this.uploadAttachments();

    // Build and send onEnd report with all accumulated data (now with attachment URLs)
    const report = this.buildRunReport('onEnd', result);
    try {
      this.logger.info(`📤 Sending ${report.hook} report to API...`);
      await sendRunReport(report, this.reportingApiBaseUrl, this.logger, this.serverKey);
      this.logger.success(`✅ Successfully sent ${report.hook} report`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Failed to send ${report.hook} report: ${errorMessage}`);
      // Don't throw - we don't want to fail the test run if reporting fails
    }
  }

  /**
   * Uploads all test attachments to S3/Wasabi via presigned URLs.
   * Updates attachment objects with remote URLs after successful upload.
   */
  private async uploadAttachments(): Promise<void> {
    this.logger.info('\n📤 Processing test attachments...');

    try {
      // Check if all attachment types are disabled
      const allAttachmentsDisabled = !this.reportScreenshots && !this.reportTraces && !this.reportVideos;

      if (allAttachmentsDisabled) {
        this.logger.info('⏭️  All attachment uploads disabled by configuration');
        return;
      }

      // Collect all attachments from all test results (both path-based and body-based)
      const allAttachments: Array<{ testId: string; resultIndex: number; attachmentIndex: number; attachment: any }> = [];

      for (const [testId, testData] of this.testCases.entries()) {
        testData.results.forEach((result, resultIndex) => {
          result.attachments.forEach((attachment, attachmentIndex) => {
            // Check if attachment has either a path (file) or body (buffer) and should be uploaded
            if ((attachment.path || attachment.body) && this.shouldUploadAttachment(attachment)) {
              allAttachments.push({ testId, resultIndex, attachmentIndex, attachment });
            }
          });
        });
      }

      if (allAttachments.length === 0) {
        this.logger.info('📎 No attachments to upload');
        return;
      }

      this.logger.info(`📎 Found ${allAttachments.length} attachment(s) to upload`);

      // Get upload credentials
      let presignedPost;
      try {
        presignedPost = await getCredentials(this.runId, this.reportingApiBaseUrl, this.logger, this.serverKey);
        this.logger.success('✅ Got upload credentials');
      } catch (error) {
        this.logger.error('❌ Failed to get upload credentials:', error);
        return; // Continue without uploading
      }

      // Upload all attachments
      let successCount = 0;
      let failCount = 0;

      for (const { testId, resultIndex, attachmentIndex, attachment } of allAttachments) {
        try {
          let url: string;
          const fileName = attachment.name + (attachment.contentType?.includes('png') ? '.png' : '');

          if (attachment.path) {
            // File-based attachment (from page.screenshot, etc.)
            url = await uploadFile(attachment.path, presignedPost, testId, this.logger);
          } else if (attachment.body) {
            // Buffer-based attachment (from testInfo.attach with body)
            url = await uploadBuffer(attachment.body, fileName, presignedPost, testId, this.logger);
          } else {
            continue; // Skip if neither path nor body
          }

          // Update the attachment with the URL
          const testData = this.testCases.get(testId);
          if (testData && testData.results[resultIndex] && testData.results[resultIndex].attachments[attachmentIndex]) {
            // Cast to any to add URL property
            (testData.results[resultIndex].attachments[attachmentIndex] as any).url = url;
          }

          this.logger.success(`✅ Uploaded: ${attachment.name}`);
          successCount++;
        } catch (error) {
          this.logger.error(`❌ Failed to upload ${attachment.name}:`, error);
          failCount++;
        }
      }

      this.logger.info(`\n📊 Upload summary: ${successCount} successful, ${failCount} failed`);
    } catch (error) {
      this.logger.error('\n❌ Error during attachment upload:', error);
      // Continue - don't fail the test run because of upload issues
    }
  }

  /**
   * Playwright lifecycle hook called when a global error occurs during the test run.
   * Builds and sends an error report.
   *
   * @param error - Test error that occurred
   */
  async onError(error: TestError): Promise<void> {
    this.logger.error(`\n❌ Global error occurred: ${error.message}`);

    // Build and send onError report
    const report = this.buildRunReport('onError', undefined, error);
    try {
      this.logger.info(`📤 Sending ${report.hook} report to API...`);
      await sendRunReport(report, this.reportingApiBaseUrl, this.logger, this.serverKey);
      this.logger.success(`✅ Successfully sent ${report.hook} report`);
    } catch (reportError) {
      const errorMessage = reportError instanceof Error ? reportError.message : String(reportError);
      this.logger.error(`❌ Failed to send ${report.hook} report: ${errorMessage}`);
      // Don't throw - we don't want to fail the test run if reporting fails
    }
  }
}

// Export git utilities for standalone use
export { getGitInfo, getBranch, getCommitSha, getShortCommitSha, getCommitMessage, getCommitAuthor, getCommitAuthorEmail, getCommitDate, getRemoteUrl, isDirty } from './git.js';

// Export types
export type { GitInfo, ReporterOptions, Attachment, RunReport, SerializableConfig, SerializableSuite, SerializableTestCase, SerializableTestResult, SerializableTestStep } from './types.js';
