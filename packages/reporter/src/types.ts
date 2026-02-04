/**
 * Response structure for presigned URL requests from the reporting API
 */
export interface PresignedUrlResponse {
  /** The presigned URL for uploading */
  url: string;
  /** The S3 key where the file will be stored */
  key: string;
}

/**
 * Request structure for requesting attachment upload credentials
 */
export interface AttachmentUploadRequest {
  /** Name of the file to upload */
  filename: string;
  /** MIME type of the file */
  contentType: string;
  /** Type of attachment being uploaded */
  attachmentType: 'screenshot' | 'trace' | 'video';
  /** Unique identifier for the test run */
  runId: string;
}

/**
 * Git repository information captured at test run time
 */
export interface GitInfo {
  /** Repository name (e.g., 'owner/repo') */
  repository?: string;
  /** Current branch name */
  branch?: string;
  /** Full commit SHA hash */
  commitSha?: string;
  /** Commit message */
  commitMessage?: string;
  /** Name of the commit author */
  commitAuthor?: string;
  /** Email of the commit author */
  commitAuthorEmail?: string;
  /** ISO 8601 timestamp of the commit */
  commitDate?: string;
  /** Whether the working directory has uncommitted changes */
  isDirty?: boolean;
  /** Remote URL of the repository */
  remoteUrl?: string;
}

/**
 * Represents a test attachment (screenshot, trace, video, etc.)
 */
export interface Attachment {
  /** Display name of the attachment */
  name: string;
  /** Local file path (before upload) */
  path?: string;
  /** MIME type of the attachment */
  contentType: string;
  /** Remote URL (after upload) */
  url?: string;
}

/**
 * Configuration options for the Playwright reporter
 */
export interface ReporterOptions {
  /** Base URL for the reporting API (default: http://localhost:3002) */
  reportingApiBaseUrl?: string;
  /**
   * Server key for authenticating with the reporting API.
   * This is an internal key used by Posium's infrastructure to protect the reporting service.
   * Falls back to REPORTING_SERVER_KEY environment variable if not provided.
   */
  serverKey?: string;
  /**
   * Run ID for this test execution.
   * Falls back to RUN_ID environment variable if not provided.
   * If neither is set, a new run ID is auto-generated.
   */
  runId?: string;
  /** Whether to upload screenshot attachments (default: true) */
  reportScreenshots?: boolean;
  /** Whether to upload trace attachments (default: true) */
  reportTraces?: boolean;
  /** Whether to upload video attachments (default: true) */
  reportVideos?: boolean;
  /** Consola log level: 0=silent, 1=error, 2=warn, 3=info, 4=debug, 5=trace (default: 3) */
  logLevel?: number;
}

/**
 * Serializable project configuration
 */
export interface SerializableProject {
  /** Project name */
  name: string;
  /** Project timeout settings */
  timeout: number;
  /** Number of retries configured */
  retries: number;
  /** Test directory */
  testDir?: string;
  /** Use of workers */
  use?: Record<string, any>;
}

/**
 * Serializable test configuration
 */
export interface SerializableConfig {
  /** Root directory */
  rootDir: string;
  /** Number of workers */
  workers: number;
  /** Global timeout */
  globalTimeout: number;
  /** Projects in the config */
  projects: SerializableProject[];
  /** Reporter configuration */
  reporter: any[];
}

/**
 * Serializable test suite information
 */
export interface SerializableSuite {
  /** Suite title */
  title: string;
  /** Suite type (project, file, describe, etc.) */
  type: 'project' | 'file' | 'describe';
  /** File path for file suites */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Child suites */
  suites: SerializableSuite[];
  /** Tests in this suite */
  tests: SerializableTestCase[];
}

/**
 * Serializable test case information
 */
export interface SerializableTestCase {
  /** Test ID */
  id: string;
  /** Test title */
  title: string;
  /** List of titles from root to this test */
  titlePath: string[];
  /** File path */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Retry index */
  retries: number;
  /** Expected status */
  expectedStatus: string;
  /** Test timeout */
  timeout: number;
  /** Test annotations */
  annotations: Array<{ type: string; description?: string; location?: { file: string; line: number; column: number } }>;
  /** Testing outcome (flaky, expected, unexpected, skipped) */
  outcome: 'skipped' | 'expected' | 'unexpected' | 'flaky';
  /** Whether test is considered ok */
  ok: boolean;
  /** Tags defined on test or suite */
  tags: string[];
  /** Repeat each index when running in repeat-each mode */
  repeatEachIndex: number;
  /** Test results from all retry attempts */
  results: SerializableTestResult[];
}

/**
 * Serializable test result for a single retry attempt
 */
export interface SerializableTestResult {
  /** Retry attempt index (0 for first attempt) */
  retry: number;
  /** Worker index that ran this test */
  workerIndex: number;
  /** Parallel index (workers running at same time have different indices) */
  parallelIndex: number;
  /** Test status */
  status: string;
  /** Duration in milliseconds */
  duration: number;
  /** Start time */
  startTime: string;
  /** First error if test failed */
  error?: {
    message?: string;
    stack?: string;
    value?: string;
    location?: { file: string; line: number; column: number };
    snippet?: string;
    cause?: any;
  };
  /** All errors thrown during test execution */
  errors: Array<{
    message?: string;
    stack?: string;
    value?: string;
    location?: { file: string; line: number; column: number };
    snippet?: string;
    cause?: any;
  }>;
  /** Test attachments */
  attachments: Attachment[];
  /** Test annotations */
  annotations: Array<{ type: string; description?: string; location?: { file: string; line: number; column: number } }>;
  /** Test steps */
  steps: SerializableTestStep[];
  /** Standard output */
  stdout: string[];
  /** Standard error */
  stderr: string[];
}

/**
 * Serializable test step information
 */
export interface SerializableTestStep {
  /** Step title */
  title: string;
  /** List of titles from root step to this step */
  titlePath: string[];
  /** Step category */
  category: string;
  /** Step start time */
  startTime: string;
  /** Step duration in milliseconds */
  duration: number;
  /** Error if step failed */
  error?: {
    message?: string;
    stack?: string;
    value?: string;
    location?: { file: string; line: number; column: number };
    snippet?: string;
    cause?: any;
  };
  /** Source location where step is defined */
  location?: { file: string; line: number; column: number };
  /** Step annotations */
  annotations: Array<{ type: string; description?: string; location?: { file: string; line: number; column: number } }>;
  /** Step attachments */
  attachments: Attachment[];
  /** Nested steps */
  steps: SerializableTestStep[];
}

/**
 * Complete run report containing all test execution data
 * Sent on onBegin, onEnd, and onError hooks
 */
export interface RunReport {
  /** Which reporter hook this report is from */
  hook: 'onBegin' | 'onEnd' | 'onError';
  /** Test framework name */
  framework: 'playwright';
  /** Unique identifier for this test run */
  runId: string;
  /** Git repository information */
  gitInfo?: GitInfo;
  /** Test configuration (from onBegin) */
  config?: SerializableConfig;
  /** Root test suite with all tests (from onBegin) */
  suite?: SerializableSuite;
  /** Overall run status (from onEnd) */
  runStatus?: 'passed' | 'failed' | 'timedout' | 'interrupted';
  /** Run start time */
  startTime?: string;
  /** Run duration in milliseconds (from onEnd) */
  duration?: number;
  /** Global error (from onError) */
  error?: {
    message?: string;
    stack?: string;
    value?: string;
  };
  /** Timestamp when this report was generated */
  reportedAt: string;
}
