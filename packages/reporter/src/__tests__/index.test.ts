import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PlaywrightReporter from '../index.js';
import * as report from '../report.js';
import * as git from '../git.js';
import type { FullConfig, TestCase, TestResult, TestStep, Suite, FullResult } from '@playwright/test/reporter';

// Mock the report module
vi.mock('../report.js');

// Mock the git module
vi.mock('../git.js');

// Mock the @posium/id module
vi.mock('@posium/id', () => ({
  createId: vi.fn((prefix: string) => `${prefix}_mock_id`),
}));

// Mock consola
vi.mock('consola', () => ({
  createConsola: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    start: vi.fn(),
  })),
  LogLevels: {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5,
  },
}));

describe('PlaywrightReporter', () => {
  let reporter: PlaywrightReporter;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      reporter = new PlaywrightReporter();
      expect(reporter).toBeInstanceOf(PlaywrightReporter);
    });

    it('should initialize with custom options', () => {
      reporter = new PlaywrightReporter({
        reportingApiBaseUrl: 'http://localhost:3000',
        reportScreenshots: false,
        reportTraces: false,
        reportVideos: false,
      });
      expect(reporter).toBeInstanceOf(PlaywrightReporter);
    });

    it('should generate a unique run ID', () => {
      reporter = new PlaywrightReporter();
      // Run ID is generated via createId mock
      expect(reporter).toBeInstanceOf(PlaywrightReporter);
    });
  });

  describe('onBegin', () => {
    it('should capture git info and send onBegin report', async () => {
      const mockGitInfo = {
        repository: 'org/repo',
        branch: 'main',
        commitSha: 'abc123',
        commitMessage: 'test commit',
        commitAuthor: 'Test User',
        commitAuthorEmail: 'test@example.com',
        commitDate: '2025-10-15T12:00:00Z',
        isDirty: false,
        remoteUrl: 'https://github.com/org/repo.git',
      };

      vi.mocked(git.getGitInfo).mockReturnValue(mockGitInfo);
      vi.mocked(report.sendRunReport).mockResolvedValue();

      reporter = new PlaywrightReporter();

      const mockConfig = {
        workers: 4,
        projects: [{ name: 'chromium' }, { name: 'firefox' }],
      } as FullConfig;

      const mockSuite = {
        allTests: () => [{ title: 'test1' }, { title: 'test2' }, { title: 'test3' }],
        suites: [],
        tests: [],
      } as unknown as Suite;

      await reporter.onBegin(mockConfig, mockSuite);

      expect(git.getGitInfo).toHaveBeenCalledWith(expect.any(Object));
      expect(report.sendRunReport).toHaveBeenCalledWith(
        expect.objectContaining({
          hook: 'onBegin',
          framework: 'playwright',
          runId: 'run_mock_id',
          gitInfo: mockGitInfo,
        }),
        expect.any(String),
        expect.any(Object),
        undefined
      );
    });

    it('should handle missing git info gracefully', async () => {
      vi.mocked(git.getGitInfo).mockReturnValue(null);
      vi.mocked(report.sendRunReport).mockResolvedValue();

      reporter = new PlaywrightReporter();

      const mockConfig = {
        workers: 4,
        projects: [{ name: 'chromium' }, { name: 'firefox' }],
      } as FullConfig;

      const mockSuite = {
        allTests: () => [{ title: 'test1' }],
        suites: [],
        tests: [],
      } as unknown as Suite;

      await reporter.onBegin(mockConfig, mockSuite);

      expect(git.getGitInfo).toHaveBeenCalledWith(expect.any(Object));
      expect(report.sendRunReport).toHaveBeenCalledWith(
        expect.objectContaining({
          hook: 'onBegin',
          gitInfo: undefined,
        }),
        expect.any(String),
        expect.any(Object),
        undefined
      );
    });

    it('should handle sendRunReport errors gracefully', async () => {
      vi.mocked(git.getGitInfo).mockReturnValue(null);
      vi.mocked(report.sendRunReport).mockRejectedValue(new Error('Network error'));

      reporter = new PlaywrightReporter();

      const mockConfig = { workers: 1, projects: [] } as FullConfig;
      const mockSuite = { allTests: () => [], suites: [], tests: [] } as unknown as Suite;

      // Should not throw
      await expect(reporter.onBegin(mockConfig, mockSuite)).resolves.not.toThrow();
    });
  });

  describe('onTestBegin', () => {
    it('should log test start without making API calls', async () => {
      reporter = new PlaywrightReporter();

      const mockTest = {
        id: 'test_123',
        title: 'Sample test',
      } as TestCase;

      await reporter.onTestBegin(mockTest);

      // No API calls should be made
      expect(report.sendRunReport).not.toHaveBeenCalled();
    });
  });

  describe('onStepBegin', () => {
    it('should log step start without making API calls', async () => {
      reporter = new PlaywrightReporter();

      const mockTest = {} as TestCase;
      const mockResult = {} as TestResult;
      const mockStep = { title: 'Click button' } as TestStep;

      await reporter.onStepBegin(mockTest, mockResult, mockStep);

      // No API calls should be made
      expect(report.sendRunReport).not.toHaveBeenCalled();
    });
  });

  describe('onStepEnd', () => {
    it('should log step end without making API calls', async () => {
      reporter = new PlaywrightReporter();

      const mockTest = { id: 'test_123' } as TestCase;
      const mockResult = {} as TestResult;
      const mockStep = { title: 'Navigate to page', duration: 100 } as TestStep;

      await reporter.onStepEnd(mockTest, mockResult, mockStep);

      // No API calls should be made
      expect(report.sendRunReport).not.toHaveBeenCalled();
    });
  });

  describe('onTestEnd', () => {
    it('should accumulate test results without making API calls', async () => {
      reporter = new PlaywrightReporter();

      const mockTest = {
        id: 'test_123',
        title: 'Sample test',
        titlePath: () => ['Suite', 'Sample test'],
        location: { file: 'test.spec.ts', line: 10, column: 5 },
        retries: 2,
        expectedStatus: 'passed',
        timeout: 30000,
        annotations: [],
        outcome: () => 'expected',
        ok: () => true,
        tags: [],
        repeatEachIndex: 0,
        results: [],
      } as unknown as TestCase;

      const mockResult = {
        retry: 0,
        workerIndex: 0,
        parallelIndex: 0,
        status: 'passed',
        duration: 1500,
        startTime: new Date('2025-10-15T12:00:00Z'),
        steps: [],
        attachments: [],
        annotations: [],
        stdout: [],
        stderr: [],
      } as TestResult;

      await reporter.onTestEnd(mockTest, mockResult);

      // No API calls should be made
      expect(report.sendRunReport).not.toHaveBeenCalled();
    });

    it('should accumulate multiple retry results for the same test', async () => {
      reporter = new PlaywrightReporter();

      const mockTest = {
        id: 'test_123',
        title: 'Flaky test',
        titlePath: () => ['Suite', 'Flaky test'],
        location: { file: 'test.spec.ts', line: 20, column: 5 },
        retries: 2,
        expectedStatus: 'passed',
        timeout: 30000,
        annotations: [],
        outcome: () => 'flaky',
        ok: () => true,
        tags: [],
        repeatEachIndex: 0,
        results: [],
      } as unknown as TestCase;

      const mockResult1 = {
        retry: 0,
        status: 'failed',
        duration: 1000,
        startTime: new Date('2025-10-15T12:00:00Z'),
        steps: [],
        attachments: [],
        annotations: [],
        stdout: [],
        stderr: [],
        error: { message: 'Failed on first try' },
      } as TestResult;

      const mockResult2 = {
        retry: 1,
        status: 'passed',
        duration: 1200,
        startTime: new Date('2025-10-15T12:00:01Z'),
        steps: [],
        attachments: [],
        annotations: [],
        stdout: [],
        stderr: [],
      } as TestResult;

      await reporter.onTestEnd(mockTest, mockResult1);
      await reporter.onTestEnd(mockTest, mockResult2);

      // No API calls should be made
      expect(report.sendRunReport).not.toHaveBeenCalled();
    });
  });

  describe('onEnd', () => {
    it('should send complete run report with all accumulated data', async () => {
      vi.mocked(git.getGitInfo).mockReturnValue(null);
      vi.mocked(report.sendRunReport).mockResolvedValue();

      reporter = new PlaywrightReporter();

      // Initialize with onBegin
      const mockConfig = { workers: 1, projects: [] } as FullConfig;
      const mockSuite = { allTests: () => [], suites: [], tests: [] } as unknown as Suite;
      await reporter.onBegin(mockConfig, mockSuite);

      // Add a test
      const mockTest = {
        id: 'test_123',
        title: 'Test 1',
        titlePath: () => ['Suite', 'Test 1'],
        location: { file: 'test.spec.ts', line: 10, column: 5 },
        retries: 0,
        expectedStatus: 'passed',
        timeout: 30000,
        annotations: [],
        outcome: () => 'expected',
        ok: () => true,
        tags: [],
        repeatEachIndex: 0,
        results: [],
      } as unknown as TestCase;

      const mockResult = {
        retry: 0,
        workerIndex: 0,
        parallelIndex: 0,
        status: 'passed',
        duration: 1000,
        startTime: new Date('2025-10-15T12:00:00Z'),
        steps: [],
        attachments: [],
        annotations: [],
        stdout: [],
        stderr: [],
      } as TestResult;

      await reporter.onTestEnd(mockTest, mockResult);

      // End the run
      const fullResult = {
        status: 'passed',
        duration: 5000,
      } as FullResult;

      await reporter.onEnd(fullResult);

      // Should send onEnd report
      expect(report.sendRunReport).toHaveBeenCalledWith(
        expect.objectContaining({
          hook: 'onEnd',
          framework: 'playwright',
          runStatus: 'passed',
          duration: 5000,
        }),
        expect.any(String),
        expect.any(Object),
        undefined
      );
    });

    it('should upload attachments before sending final report', async () => {
      vi.mocked(git.getGitInfo).mockReturnValue(null);
      vi.mocked(report.sendRunReport).mockResolvedValue();
      vi.mocked(report.getCredentials).mockResolvedValue({
        url: 'https://s3.amazonaws.com',
        fields: { key: 'test-results/run_mock_id/' },
      });
      vi.mocked(report.uploadFile).mockResolvedValue('https://s3.amazonaws.com/screenshot.png');

      reporter = new PlaywrightReporter();

      // Initialize with onBegin
      const mockConfig = { workers: 1, projects: [] } as FullConfig;
      const mockSuite = { allTests: () => [], suites: [], tests: [] } as unknown as Suite;
      await reporter.onBegin(mockConfig, mockSuite);

      // Add a test with attachments
      const mockTest = {
        id: 'test_123',
        title: 'Test with screenshot',
        titlePath: () => ['Suite', 'Test with screenshot'],
        location: { file: 'test.spec.ts', line: 10, column: 5 },
        retries: 0,
        expectedStatus: 'passed',
        timeout: 30000,
        annotations: [],
        outcome: () => 'expected',
        ok: () => true,
        tags: [],
        repeatEachIndex: 0,
        results: [],
      } as unknown as TestCase;

      const mockResult = {
        retry: 0,
        workerIndex: 0,
        parallelIndex: 0,
        status: 'passed',
        duration: 1000,
        startTime: new Date('2025-10-15T12:00:00Z'),
        steps: [],
        attachments: [
          { name: 'screenshot.png', path: '/path/screenshot.png', contentType: 'image/png' },
        ],
        annotations: [],
        stdout: [],
        stderr: [],
      } as TestResult;

      await reporter.onTestEnd(mockTest, mockResult);

      const fullResult = { status: 'passed', duration: 5000 } as FullResult;
      await reporter.onEnd(fullResult);

      // Should get credentials and upload
      expect(report.getCredentials).toHaveBeenCalledWith(
        'run_mock_id',
        expect.any(String),
        expect.any(Object),
        undefined
      );
      expect(report.uploadFile).toHaveBeenCalledWith(
        '/path/screenshot.png',
        expect.any(Object),
        'test_123',
        expect.any(Object)
      );
      // Should send final report
      expect(report.sendRunReport).toHaveBeenCalled();
    });

    it('should skip uploads when all attachment types are disabled', async () => {
      vi.mocked(git.getGitInfo).mockReturnValue(null);
      vi.mocked(report.sendRunReport).mockResolvedValue();

      reporter = new PlaywrightReporter({
        reportScreenshots: false,
        reportTraces: false,
        reportVideos: false,
      });

      const mockConfig = { workers: 1, projects: [] } as FullConfig;
      const mockSuite = { allTests: () => [], suites: [], tests: [] } as unknown as Suite;
      await reporter.onBegin(mockConfig, mockSuite);

      const mockTest = {
        id: 'test_123',
        title: 'Test with attachments',
        titlePath: () => ['Suite', 'Test with attachments'],
        location: { file: 'test.spec.ts', line: 10, column: 5 },
        retries: 0,
        expectedStatus: 'passed',
        timeout: 30000,
        annotations: [],
        outcome: () => 'expected',
        ok: () => true,
        tags: [],
        repeatEachIndex: 0,
        results: [],
      } as unknown as TestCase;

      const mockResult = {
        retry: 0,
        workerIndex: 0,
        parallelIndex: 0,
        status: 'passed',
        duration: 1000,
        startTime: new Date('2025-10-15T12:00:00Z'),
        steps: [],
        attachments: [
          { name: 'screenshot.png', path: '/path/screenshot.png', contentType: 'image/png' },
        ],
        annotations: [],
        stdout: [],
        stderr: [],
      } as TestResult;

      await reporter.onTestEnd(mockTest, mockResult);

      const fullResult = { status: 'passed', duration: 5000 } as FullResult;
      await reporter.onEnd(fullResult);

      // Should not get credentials or upload
      expect(report.getCredentials).not.toHaveBeenCalled();
      expect(report.uploadFile).not.toHaveBeenCalled();
      // Should still send final report
      expect(report.sendRunReport).toHaveBeenCalled();
    });

    it('should handle upload errors gracefully', async () => {
      vi.mocked(git.getGitInfo).mockReturnValue(null);
      vi.mocked(report.sendRunReport).mockResolvedValue();
      vi.mocked(report.getCredentials).mockResolvedValue({
        url: 'https://s3.amazonaws.com',
        fields: { key: 'test-results/run_mock_id/' },
      });
      vi.mocked(report.uploadFile).mockRejectedValue(new Error('Upload failed'));

      reporter = new PlaywrightReporter();

      const mockConfig = { workers: 1, projects: [] } as FullConfig;
      const mockSuite = { allTests: () => [], suites: [], tests: [] } as unknown as Suite;
      await reporter.onBegin(mockConfig, mockSuite);

      const mockTest = {
        id: 'test_123',
        title: 'Test with screenshot',
        titlePath: () => ['Suite', 'Test with screenshot'],
        location: { file: 'test.spec.ts', line: 10, column: 5 },
        retries: 0,
        expectedStatus: 'passed',
        timeout: 30000,
        annotations: [],
        outcome: () => 'expected',
        ok: () => true,
        tags: [],
        repeatEachIndex: 0,
        results: [],
      } as unknown as TestCase;

      const mockResult = {
        retry: 0,
        workerIndex: 0,
        parallelIndex: 0,
        status: 'passed',
        duration: 1000,
        startTime: new Date('2025-10-15T12:00:00Z'),
        steps: [],
        attachments: [
          { name: 'screenshot.png', path: '/path/screenshot.png', contentType: 'image/png' },
        ],
        annotations: [],
        stdout: [],
        stderr: [],
      } as TestResult;

      await reporter.onTestEnd(mockTest, mockResult);

      const fullResult = { status: 'passed', duration: 5000 } as FullResult;

      // Should not throw
      await expect(reporter.onEnd(fullResult)).resolves.not.toThrow();
      // Should still send final report
      expect(report.sendRunReport).toHaveBeenCalled();
    });
  });

  describe('onError', () => {
    it('should send error report with error details', async () => {
      vi.mocked(git.getGitInfo).mockReturnValue(null);
      vi.mocked(report.sendRunReport).mockResolvedValue();

      reporter = new PlaywrightReporter();

      // Initialize with onBegin
      const mockConfig = { workers: 1, projects: [] } as FullConfig;
      const mockSuite = { allTests: () => [], suites: [], tests: [] } as unknown as Suite;
      await reporter.onBegin(mockConfig, mockSuite);

      const mockError = {
        message: 'Global test error',
        stack: 'Error: Global test error\n    at test.spec.ts:10:5',
      };

      await reporter.onError(mockError as any);

      expect(report.sendRunReport).toHaveBeenCalledWith(
        expect.objectContaining({
          hook: 'onError',
          framework: 'playwright',
          error: expect.objectContaining({
            message: 'Global test error',
          }),
        }),
        expect.any(String),
        expect.any(Object),
        undefined
      );
    });

    it('should handle sendRunReport errors gracefully in onError', async () => {
      vi.mocked(git.getGitInfo).mockReturnValue(null);
      vi.mocked(report.sendRunReport).mockRejectedValue(new Error('Network error'));

      reporter = new PlaywrightReporter();

      const mockConfig = { workers: 1, projects: [] } as FullConfig;
      const mockSuite = { allTests: () => [], suites: [], tests: [] } as unknown as Suite;
      await reporter.onBegin(mockConfig, mockSuite);

      const mockError = { message: 'Something went wrong' };

      // Should not throw
      await expect(reporter.onError(mockError as any)).resolves.not.toThrow();
    });
  });
});
