import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { getCredentials, uploadFile, sendRunReport } from '../report.js';

// Mock the http, https, and fs modules
vi.mock('http');
vi.mock('https');
vi.mock('fs');

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

describe('report.ts', () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    start: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCredentials', () => {
    it('should fetch upload credentials successfully', async () => {
      const mockRunId = 'run_123';
      const mockApiBaseUrl = 'https://api.example.com';
      const mockResponse = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: {
          key: 'test-results/run_123/',
          'x-amz-algorithm': 'AWS4-HMAC-SHA256',
        },
      };

      // Mock the https request
      const mockReq = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      };

      const mockRes = {
        statusCode: 200,
        on: vi.fn((event: string, handler: any) => {
          if (event === 'data') {
            handler(JSON.stringify(mockResponse));
          }
          if (event === 'end') {
            handler();
          }
          return mockRes;
        }),
      };

      vi.mocked(https.request).mockImplementation((options: any, callback: any) => {
        callback(mockRes);
        return mockReq as any;
      });

      const result = await getCredentials(mockRunId, mockApiBaseUrl, mockLogger as any);

      expect(result).toEqual(mockResponse);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'api.example.com',
          path: '/v1/credentials',
          method: 'POST',
        }),
        expect.any(Function)
      );
    });

    it('should reject on HTTP error', async () => {
      const mockRunId = 'run_123';
      const mockApiBaseUrl = 'https://api.example.com';

      const mockReq = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      };

      const mockRes = {
        statusCode: 500,
        on: vi.fn((event: string, handler: any) => {
          if (event === 'data') {
            handler('Internal Server Error');
          }
          if (event === 'end') {
            handler();
          }
          return mockRes;
        }),
      };

      vi.mocked(https.request).mockImplementation((options: any, callback: any) => {
        callback(mockRes);
        return mockReq as any;
      });

      await expect(getCredentials(mockRunId, mockApiBaseUrl, mockLogger as any)).rejects.toThrow('HTTP 500');
    });

    it('should reject on network error', async () => {
      const mockRunId = 'run_123';
      const mockApiBaseUrl = 'https://api.example.com';

      const mockReq = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn((event: string, handler: any) => {
          if (event === 'error') {
            handler(new Error('Network error'));
          }
          return mockReq;
        }),
      };

      vi.mocked(https.request).mockImplementation(() => {
        setTimeout(() => {
          const errorHandler = mockReq.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
          if (errorHandler) errorHandler(new Error('Network error'));
        }, 0);
        return mockReq as any;
      });

      await expect(getCredentials(mockRunId, mockApiBaseUrl, mockLogger as any)).rejects.toThrow('Network error');
    });
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const mockFilePath = '/path/to/screenshot.png';
      const mockTestId = 'test_123';
      const mockPresignedPost = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: {
          key: 'test-results/run_123/',
          'x-amz-algorithm': 'AWS4-HMAC-SHA256',
        },
      };

      // Mock file system
      const mockFileStream = {
        pipe: vi.fn().mockReturnThis(),
        on: vi.fn((event: string, handler: any) => {
          if (event === 'end') {
            setTimeout(handler, 0);
          }
          return mockFileStream;
        }),
      };

      vi.mocked(fs.createReadStream).mockReturnValue(mockFileStream as any);
      vi.mocked(fs.statSync).mockReturnValue({ size: 1024 } as any);

      // Mock https request
      const mockReq = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };

      const mockRes = {
        statusCode: 204,
        on: vi.fn((event: string, handler: any) => {
          if (event === 'data') {
            handler('');
          }
          if (event === 'end') {
            handler();
          }
          return mockRes;
        }),
      };

      vi.mocked(https.request).mockImplementation((url: any, options: any, callback: any) => {
        callback(mockRes);
        return mockReq as any;
      });

      const result = await uploadFile(mockFilePath, mockPresignedPost, mockTestId, mockLogger as any);

      expect(result).toContain('test-results/run_123/test_123/screenshot.png');
      expect(fs.createReadStream).toHaveBeenCalledWith(mockFilePath);
      expect(https.request).toHaveBeenCalled();
    });

    it('should handle upload failure', async () => {
      const mockFilePath = '/path/to/screenshot.png';
      const mockTestId = 'test_123';
      const mockPresignedPost = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: {
          key: 'test-results/run_123/',
        },
      };

      const mockFileStream = {
        pipe: vi.fn().mockReturnThis(),
        on: vi.fn((event: string, handler: any) => {
          if (event === 'end') {
            setTimeout(handler, 0);
          }
          return mockFileStream;
        }),
      };

      vi.mocked(fs.createReadStream).mockReturnValue(mockFileStream as any);
      vi.mocked(fs.statSync).mockReturnValue({ size: 1024 } as any);

      const mockReq = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };

      const mockRes = {
        statusCode: 403,
        on: vi.fn((event: string, handler: any) => {
          if (event === 'data') {
            handler('Access Denied');
          }
          if (event === 'end') {
            handler();
          }
          return mockRes;
        }),
      };

      vi.mocked(https.request).mockImplementation((url: any, options: any, callback: any) => {
        callback(mockRes);
        return mockReq as any;
      });

      await expect(uploadFile(mockFilePath, mockPresignedPost, mockTestId, mockLogger as any)).rejects.toThrow(
        'Upload failed with status 403'
      );
    });

    it('should handle file read errors', async () => {
      const mockFilePath = '/path/to/missing.png';
      const mockTestId = 'test_123';
      const mockPresignedPost = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: { key: 'test-results/run_123/' },
      };

      const mockFileStream = {
        pipe: vi.fn().mockReturnThis(),
        on: vi.fn((event: string, handler: any) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('File not found')), 0);
          }
          return mockFileStream;
        }),
      };

      vi.mocked(fs.createReadStream).mockReturnValue(mockFileStream as any);
      vi.mocked(fs.statSync).mockReturnValue({ size: 1024 } as any);

      const mockReq = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      };

      vi.mocked(https.request).mockImplementation(() => {
        return mockReq as any;
      });

      await expect(uploadFile(mockFilePath, mockPresignedPost, mockTestId, mockLogger as any)).rejects.toThrow(
        'File read error'
      );
    });
  });

  describe('sendRunReport', () => {
    it('should send run report successfully', async () => {
      const mockRunReport = {
        hook: 'onEnd',
        framework: 'playwright',
        runId: 'run_123',
        gitInfo: null,
        config: {},
        suite: {},
        runStatus: 'passed',
        duration: 5000,
      };

      const mockApiBaseUrl = 'https://api.example.com';

      const mockReq = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      };

      const mockRes = {
        statusCode: 200,
        on: vi.fn((event: string, handler: any) => {
          if (event === 'data') {
            handler(JSON.stringify({ success: true }));
          }
          if (event === 'end') {
            handler();
          }
          return mockRes;
        }),
      };

      vi.mocked(https.request).mockImplementation((options: any, callback: any) => {
        callback(mockRes);
        return mockReq as any;
      });

      await sendRunReport(mockRunReport, mockApiBaseUrl, mockLogger as any);

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'api.example.com',
          path: '/v1/playwright/report',
          method: 'POST',
        }),
        expect.any(Function)
      );
      expect(mockReq.write).toHaveBeenCalledWith(expect.stringContaining('"hook":"onEnd"'));
    });

    it('should handle API errors and throw', async () => {
      const mockRunReport = {
        hook: 'onEnd',
        framework: 'playwright',
        runId: 'run_123',
      };

      const mockApiBaseUrl = 'https://api.example.com';

      const mockReq = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      };

      const mockRes = {
        statusCode: 500,
        on: vi.fn((event: string, handler: any) => {
          if (event === 'data') {
            handler('Internal Server Error');
          }
          if (event === 'end') {
            handler();
          }
          return mockRes;
        }),
      };

      vi.mocked(https.request).mockImplementation((options: any, callback: any) => {
        callback(mockRes);
        return mockReq as any;
      });

      await expect(sendRunReport(mockRunReport, mockApiBaseUrl, mockLogger as any)).rejects.toThrow('HTTP 500');
    });

    it('should support http API endpoints', async () => {
      const mockRunReport = {
        hook: 'onBegin',
        framework: 'playwright',
        runId: 'run_123',
      };

      const mockApiBaseUrl = 'http://localhost:3000';

      const mockReq = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      };

      const mockRes = {
        statusCode: 200,
        on: vi.fn((event: string, handler: any) => {
          if (event === 'data') {
            handler('{}');
          }
          if (event === 'end') {
            handler();
          }
          return mockRes;
        }),
      };

      vi.mocked(http.request).mockImplementation((options: any, callback: any) => {
        callback(mockRes);
        return mockReq as any;
      });

      await sendRunReport(mockRunReport, mockApiBaseUrl, mockLogger as any);

      expect(http.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'localhost',
          port: '3000',
          path: '/v1/playwright/report',
          method: 'POST',
        }),
        expect.any(Function)
      );
    });
  });
});
