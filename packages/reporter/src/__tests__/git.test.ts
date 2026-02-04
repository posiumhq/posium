import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import {
  getGitInfo,
  getBranch,
  getCommitSha,
  getShortCommitSha,
  getCommitMessage,
  getCommitAuthor,
  getCommitAuthorEmail,
  getCommitDate,
  getRemoteUrl,
  isDirty,
} from '../git.js';

// Mock child_process
vi.mock('child_process');

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

describe('git utilities', () => {
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

  describe('getBranch', () => {
    it('should return the current branch name', () => {
      vi.mocked(execSync).mockReturnValue('main\n' as any);

      const result = getBranch();

      expect(result).toBe('main');
      expect(execSync).toHaveBeenCalledWith('git rev-parse --abbrev-ref HEAD', expect.any(Object));
    });

    it('should return null when git command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getBranch();

      expect(result).toBeNull();
    });

    it('should trim whitespace from branch name', () => {
      vi.mocked(execSync).mockReturnValue('  feature/test-branch  \n' as any);

      const result = getBranch();

      expect(result).toBe('feature/test-branch');
    });
  });

  describe('getCommitSha', () => {
    it('should return the full commit SHA', () => {
      const mockSha = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';
      vi.mocked(execSync).mockReturnValue(mockSha + '\n' as any);

      const result = getCommitSha();

      expect(result).toBe(mockSha);
      expect(execSync).toHaveBeenCalledWith('git rev-parse HEAD', expect.any(Object));
    });

    it('should return null when git command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getCommitSha();

      expect(result).toBeNull();
    });
  });

  describe('getShortCommitSha', () => {
    it('should return the short commit SHA', () => {
      vi.mocked(execSync).mockReturnValue('a1b2c3d\n' as any);

      const result = getShortCommitSha();

      expect(result).toBe('a1b2c3d');
      expect(execSync).toHaveBeenCalledWith('git rev-parse --short HEAD', expect.any(Object));
    });

    it('should return null when git command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getShortCommitSha();

      expect(result).toBeNull();
    });
  });

  describe('getCommitMessage', () => {
    it('should return the commit message', () => {
      const mockMessage = 'feat: add new feature';
      vi.mocked(execSync).mockReturnValue(mockMessage + '\n' as any);

      const result = getCommitMessage();

      expect(result).toBe(mockMessage);
      expect(execSync).toHaveBeenCalledWith('git log -1 --pretty=%B', expect.any(Object));
    });

    it('should handle multi-line commit messages', () => {
      const mockMessage = 'feat: add new feature\n\nThis is a longer description\nwith multiple lines';
      vi.mocked(execSync).mockReturnValue(mockMessage + '\n' as any);

      const result = getCommitMessage();

      expect(result).toBe(mockMessage);
    });

    it('should return null when git command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getCommitMessage();

      expect(result).toBeNull();
    });
  });

  describe('getCommitAuthor', () => {
    it('should return the commit author name', () => {
      vi.mocked(execSync).mockReturnValue('John Doe\n' as any);

      const result = getCommitAuthor();

      expect(result).toBe('John Doe');
      expect(execSync).toHaveBeenCalledWith('git log -1 --pretty=%an', expect.any(Object));
    });

    it('should return null when git command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getCommitAuthor();

      expect(result).toBeNull();
    });
  });

  describe('getCommitAuthorEmail', () => {
    it('should return the commit author email', () => {
      vi.mocked(execSync).mockReturnValue('john@example.com\n' as any);

      const result = getCommitAuthorEmail();

      expect(result).toBe('john@example.com');
      expect(execSync).toHaveBeenCalledWith('git log -1 --pretty=%ae', expect.any(Object));
    });

    it('should return null when git command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getCommitAuthorEmail();

      expect(result).toBeNull();
    });
  });

  describe('getCommitDate', () => {
    it('should return the commit date in ISO format', () => {
      const mockDate = '2025-10-15T12:00:00-07:00';
      vi.mocked(execSync).mockReturnValue(mockDate + '\n' as any);

      const result = getCommitDate();

      expect(result).toBe(mockDate);
      expect(execSync).toHaveBeenCalledWith('git log -1 --pretty=%aI', expect.any(Object));
    });

    it('should return null when git command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getCommitDate();

      expect(result).toBeNull();
    });
  });

  describe('getRemoteUrl', () => {
    it('should return the remote URL for origin', () => {
      const mockUrl = 'https://github.com/user/repo.git';
      vi.mocked(execSync).mockReturnValue(mockUrl + '\n' as any);

      const result = getRemoteUrl();

      expect(result).toBe(mockUrl);
      expect(execSync).toHaveBeenCalledWith('git remote get-url origin', expect.any(Object));
    });

    it('should support custom remote names', () => {
      const mockUrl = 'https://github.com/user/repo.git';
      vi.mocked(execSync).mockReturnValue(mockUrl + '\n' as any);

      const result = getRemoteUrl('upstream');

      expect(result).toBe(mockUrl);
      expect(execSync).toHaveBeenCalledWith('git remote get-url upstream', expect.any(Object));
    });

    it('should return null when remote does not exist', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('No such remote');
      });

      const result = getRemoteUrl();

      expect(result).toBeNull();
    });
  });

  describe('isDirty', () => {
    it('should return true when there are uncommitted changes', () => {
      vi.mocked(execSync).mockReturnValue(' M src/file.ts\n?? new-file.ts\n' as any);

      const result = isDirty();

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith('git status --porcelain', expect.any(Object));
    });

    it('should return false when working directory is clean', () => {
      vi.mocked(execSync).mockReturnValue('' as any);

      const result = isDirty();

      expect(result).toBe(false);
    });

    it('should return false when git command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = isDirty();

      expect(result).toBe(false);
    });
  });

  describe('getGitInfo', () => {
    it('should return comprehensive git information', () => {
      const mockResponses: Record<string, string> = {
        'git rev-parse --is-inside-work-tree': 'true',
        'git remote get-url origin': 'https://github.com/org/repo-name.git',
        'git rev-parse --abbrev-ref HEAD': 'main',
        'git rev-parse HEAD': 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
        'git log -1 --pretty=%B': 'feat: add new feature',
        'git log -1 --pretty=%an': 'John Doe',
        'git log -1 --pretty=%ae': 'john@example.com',
        'git log -1 --pretty=%aI': '2025-10-15T12:00:00-07:00',
        'git status --porcelain': ' M src/file.ts',
      };

      vi.mocked(execSync).mockImplementation((command: string) => {
        const cmd = command.toString();
        return (mockResponses[cmd] || '') as any;
      });

      const result = getGitInfo(mockLogger as any);

      expect(result).toEqual({
        repository: 'org/repo-name',
        branch: 'main',
        commitSha: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
        commitMessage: 'feat: add new feature',
        commitAuthor: 'John Doe',
        commitAuthorEmail: 'john@example.com',
        commitDate: '2025-10-15T12:00:00-07:00',
        isDirty: true,
        remoteUrl: 'https://github.com/org/repo-name.git',
      });
    });

    it('should extract repository name from SSH URL', () => {
      const mockResponses: Record<string, string> = {
        'git rev-parse --is-inside-work-tree': 'true',
        'git remote get-url origin': 'git@github.com:org/repo-name.git',
        'git rev-parse --abbrev-ref HEAD': 'main',
        'git rev-parse HEAD': 'abc123',
        'git log -1 --pretty=%B': 'test commit',
        'git log -1 --pretty=%an': 'Jane Doe',
        'git log -1 --pretty=%ae': 'jane@example.com',
        'git log -1 --pretty=%aI': '2025-10-15T12:00:00Z',
        'git status --porcelain': '',
      };

      vi.mocked(execSync).mockImplementation((command: string) => {
        const cmd = command.toString();
        return (mockResponses[cmd] || '') as any;
      });

      const result = getGitInfo(mockLogger as any);

      expect(result?.repository).toBe('org/repo-name');
      expect(result?.remoteUrl).toBe('git@github.com:org/repo-name.git');
    });

    it('should extract repository name from SSH protocol URL', () => {
      const mockResponses: Record<string, string> = {
        'git rev-parse --is-inside-work-tree': 'true',
        'git remote get-url origin': 'ssh://git@bitbucket.org/org/repo-name.git',
        'git rev-parse --abbrev-ref HEAD': 'develop',
        'git rev-parse HEAD': 'xyz789',
        'git log -1 --pretty=%B': 'fix: bug fix',
        'git log -1 --pretty=%an': 'Bob Smith',
        'git log -1 --pretty=%ae': 'bob@example.com',
        'git log -1 --pretty=%aI': '2025-10-14T10:00:00Z',
        'git status --porcelain': '',
      };

      vi.mocked(execSync).mockImplementation((command: string) => {
        const cmd = command.toString();
        return (mockResponses[cmd] || '') as any;
      });

      const result = getGitInfo(mockLogger as any);

      expect(result?.repository).toBe('org/repo-name');
      expect(result?.remoteUrl).toBe('ssh://git@bitbucket.org/org/repo-name.git');
    });

    it('should handle URLs without .git extension', () => {
      const mockResponses: Record<string, string> = {
        'git rev-parse --is-inside-work-tree': 'true',
        'git remote get-url origin': 'https://gitlab.com/org/repo-name',
        'git rev-parse --abbrev-ref HEAD': 'main',
        'git rev-parse HEAD': 'abc123',
        'git log -1 --pretty=%B': 'test',
        'git log -1 --pretty=%an': 'User',
        'git log -1 --pretty=%ae': 'user@example.com',
        'git log -1 --pretty=%aI': '2025-10-15T12:00:00Z',
        'git status --porcelain': '',
      };

      vi.mocked(execSync).mockImplementation((command: string) => {
        const cmd = command.toString();
        return (mockResponses[cmd] || '') as any;
      });

      const result = getGitInfo(mockLogger as any);

      expect(result?.repository).toBe('org/repo-name');
    });

    it('should return null when not in a git repository', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getGitInfo(mockLogger as any);

      expect(result).toBeNull();
    });

    it('should handle missing remote URL gracefully', () => {
      const mockResponses: Record<string, string> = {
        'git rev-parse --is-inside-work-tree': 'true',
        'git rev-parse --abbrev-ref HEAD': 'main',
        'git rev-parse HEAD': 'abc123',
        'git log -1 --pretty=%B': 'test commit',
        'git log -1 --pretty=%an': 'User',
        'git log -1 --pretty=%ae': 'user@example.com',
        'git log -1 --pretty=%aI': '2025-10-15T12:00:00Z',
        'git status --porcelain': '',
      };

      vi.mocked(execSync).mockImplementation((command: string) => {
        const cmd = command.toString();
        if (cmd.includes('git remote get-url')) {
          throw new Error('No remote configured');
        }
        return (mockResponses[cmd] || '') as any;
      });

      const result = getGitInfo(mockLogger as any);

      expect(result).toBeDefined();
      expect(result?.remoteUrl).toBeUndefined();
      expect(result?.repository).toBeUndefined();
      expect(result?.branch).toBe('main');
    });

    it('should mark as clean when no changes', () => {
      const mockResponses: Record<string, string> = {
        'git rev-parse --is-inside-work-tree': 'true',
        'git remote get-url origin': 'https://github.com/org/repo.git',
        'git rev-parse --abbrev-ref HEAD': 'main',
        'git rev-parse HEAD': 'abc123',
        'git log -1 --pretty=%B': 'test',
        'git log -1 --pretty=%an': 'User',
        'git log -1 --pretty=%ae': 'user@example.com',
        'git log -1 --pretty=%aI': '2025-10-15T12:00:00Z',
        'git status --porcelain': '',
      };

      vi.mocked(execSync).mockImplementation((command: string) => {
        const cmd = command.toString();
        return (mockResponses[cmd] || '') as any;
      });

      const result = getGitInfo(mockLogger as any);

      expect(result?.isDirty).toBe(false);
    });
  });

  describe('getGitInfo', () => {
    it('should return git info and log success', () => {
      const mockResponses: Record<string, string> = {
        'git rev-parse --is-inside-work-tree': 'true',
        'git remote get-url origin': 'https://github.com/org/repo.git',
        'git rev-parse --abbrev-ref HEAD': 'main',
        'git rev-parse HEAD': 'a1b2c3d4e5f6g7h8',
        'git log -1 --pretty=%B': 'test commit',
        'git log -1 --pretty=%an': 'User',
        'git log -1 --pretty=%ae': 'user@example.com',
        'git log -1 --pretty=%aI': '2025-10-15T12:00:00Z',
        'git status --porcelain': '',
      };

      vi.mocked(execSync).mockImplementation((command: string) => {
        const cmd = command.toString();
        return (mockResponses[cmd] || '') as any;
      });

      const result = getGitInfo(mockLogger as any);

      expect(result).toBeDefined();
      expect(result?.branch).toBe('main');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Git information captured'),
        expect.objectContaining({
          repository: 'org/repo',
          branch: 'main',
        })
      );
    });

    it('should return null and log message when not in git repo', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getGitInfo(mockLogger as any);

      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Not in a git repository')
      );
    });

    it('should handle errors gracefully', () => {
      // When execSync throws an error after confirming we're in a git repo,
      // getGitInfo will still return the git info (potentially with undefined fields)
      // but won't throw an error
      let callCount = 0;
      vi.mocked(execSync).mockImplementation((command: string) => {
        callCount++;
        const cmd = command.toString();
        if (cmd.includes('is-inside-work-tree')) {
          return 'true' as any;
        }
        // Return empty strings for other commands to simulate partial failure
        return '' as any;
      });

      const result = getGitInfo(mockLogger as any);

      // Should still return an object (not throw) but with undefined/empty values
      expect(result).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Git information captured'),
        expect.any(Object)
      );
    });
  });

  describe('git command options', () => {
    it('should use correct encoding and timeout options', () => {
      vi.mocked(execSync).mockReturnValue('main' as any);

      getBranch();

      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          encoding: 'utf-8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'ignore'],
        })
      );
    });

    it('should suppress stderr output', () => {
      vi.mocked(execSync).mockReturnValue('main' as any);

      getBranch();

      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'ignore'],
        })
      );
    });
  });
});

