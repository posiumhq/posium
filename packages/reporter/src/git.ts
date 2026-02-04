import { execSync } from 'child_process';
import type { createConsola } from 'consola';

/**
 * Git repository information structure (re-exported from types.ts)
 * @deprecated Import from './types' instead
 */
export interface GitInfo {
  repository?: string;
  branch?: string;
  commitSha?: string;
  commitMessage?: string;
  commitAuthor?: string;
  commitAuthorEmail?: string;
  commitDate?: string;
  isDirty?: boolean;
  remoteUrl?: string;
}

/**
 * Executes a git command using child_process and returns the output.
 * Automatically handles errors and timeouts gracefully.
 *
 * @param command - Git command to execute (e.g., 'git rev-parse HEAD')
 * @returns Trimmed command output, or null if the command fails or times out
 * @internal
 */
function execGitCommand(command: string): string | null {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
      timeout: 5000, // 5 second timeout
    }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Extracts the repository name from a git remote URL.
 * Handles various Git URL formats from different providers (GitHub, GitLab, Bitbucket, etc.).
 *
 * Supported formats:
 * - HTTPS: https://github.com/user/repo.git → user/repo
 * - SSH: git@github.com:user/repo.git → user/repo
 * - SSH Protocol: ssh://git@bitbucket.org/user/repo.git → user/repo
 *
 * @param remoteUrl - Full git remote URL
 * @returns Repository name in 'owner/repo' format, or the original URL if parsing fails
 * @internal
 */
function extractRepoName(remoteUrl: string): string | undefined {
  try {
    // Handle various Git URL formats:
    // - https://github.com/user/repo.git
    // - git@github.com:user/repo.git
    // - https://gitlab.com/user/repo
    // - ssh://git@bitbucket.org/user/repo.git

    const httpsMatch = remoteUrl.match(/https?:\/\/[^\/]+\/(.+?)(?:\.git)?$/);
    if (httpsMatch) {
      return httpsMatch[1];
    }

    const sshMatch = remoteUrl.match(/git@[^:]+:(.+?)(?:\.git)?$/);
    if (sshMatch) {
      return sshMatch[1];
    }

    const sshProtocolMatch = remoteUrl.match(/ssh:\/\/git@[^\/]+\/(.+?)(?:\.git)?$/);
    if (sshProtocolMatch) {
      return sshProtocolMatch[1];
    }

    return remoteUrl;
  } catch (error) {
    return remoteUrl;
  }
}

/**
 * Gets the current git branch name.
 *
 * @returns Branch name (e.g., 'main', 'feature/my-feature'), or null if not in a git repo
 * @example
 * ```typescript
 * const branch = getBranch(); // 'main'
 * ```
 */
export function getBranch(): string | null {
  return execGitCommand('git rev-parse --abbrev-ref HEAD');
}

/**
 * Gets the full commit SHA hash of the current HEAD.
 *
 * @returns Full 40-character commit SHA, or null if not in a git repo
 * @example
 * ```typescript
 * const sha = getCommitSha(); // 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0'
 * ```
 */
export function getCommitSha(): string | null {
  return execGitCommand('git rev-parse HEAD');
}

/**
 * Gets the short (7-character) commit SHA hash of the current HEAD.
 *
 * @returns Short commit SHA, or null if not in a git repo
 * @example
 * ```typescript
 * const shortSha = getShortCommitSha(); // 'a1b2c3d'
 * ```
 */
export function getShortCommitSha(): string | null {
  return execGitCommand('git rev-parse --short HEAD');
}

/**
 * Gets the commit message of the current HEAD.
 *
 * @returns Full commit message (may include multiple lines), or null if not in a git repo
 * @example
 * ```typescript
 * const message = getCommitMessage(); // 'feat: add new feature\n\nDetailed description here'
 * ```
 */
export function getCommitMessage(): string | null {
  return execGitCommand('git log -1 --pretty=%B');
}

/**
 * Gets the name of the author of the current HEAD commit.
 *
 * @returns Commit author name, or null if not in a git repo
 * @example
 * ```typescript
 * const author = getCommitAuthor(); // 'John Doe'
 * ```
 */
export function getCommitAuthor(): string | null {
  return execGitCommand('git log -1 --pretty=%an');
}

/**
 * Gets the email address of the author of the current HEAD commit.
 *
 * @returns Commit author email, or null if not in a git repo
 * @example
 * ```typescript
 * const email = getCommitAuthorEmail(); // 'john.doe@example.com'
 * ```
 */
export function getCommitAuthorEmail(): string | null {
  return execGitCommand('git log -1 --pretty=%ae');
}

/**
 * Gets the date of the current HEAD commit in ISO 8601 format.
 *
 * @returns ISO 8601 formatted date string, or null if not in a git repo
 * @example
 * ```typescript
 * const date = getCommitDate(); // '2023-10-16T12:34:56-07:00'
 * ```
 */
export function getCommitDate(): string | null {
  return execGitCommand('git log -1 --pretty=%aI');
}

/**
 * Gets the remote URL for a specified git remote.
 *
 * @param remote - Name of the remote (defaults to 'origin')
 * @returns Remote URL, or null if the remote doesn't exist or not in a git repo
 * @example
 * ```typescript
 * const url = getRemoteUrl(); // 'https://github.com/user/repo.git'
 * const upstreamUrl = getRemoteUrl('upstream'); // 'https://github.com/upstream/repo.git'
 * ```
 */
export function getRemoteUrl(remote: string = 'origin'): string | null {
  return execGitCommand(`git remote get-url ${remote}`);
}

/**
 * Checks if the working directory has uncommitted changes (staged or unstaged).
 * Uses `git status --porcelain` to detect any modifications, additions, or deletions.
 *
 * @returns True if there are uncommitted changes, false if the working tree is clean
 * @example
 * ```typescript
 * if (isDirty()) {
 *   console.log('You have uncommitted changes!');
 * }
 * ```
 */
export function isDirty(): boolean {
  const status = execGitCommand('git status --porcelain');
  return status !== null && status.length > 0;
}

/**
 * Gathers comprehensive git information about the current repository.
 * Collects branch, commit details, author information, and working tree status.
 *
 * @returns Object containing all available git information, or null if not in a git repository
 * @example
 * ```typescript
 * const gitInfo = getGitInfo();
 * if (gitInfo) {
 *   console.log(`Running on branch: ${gitInfo.branch}`);
 *   console.log(`Latest commit: ${gitInfo.commitSha}`);
 *   console.log(`Working tree is ${gitInfo.isDirty ? 'dirty' : 'clean'}`);
 * }
 * ```
 */
/**
 * Gathers git information with error handling and logging.
 * Safely captures repository, branch, commit, and other git metadata.
 *
 * @param logger - Consola logger instance for output
 * @returns Object containing all available git information, or null if not in a git repository or on error
 * @example
 * ```typescript
 * import { createConsola } from 'consola';
 * const logger = createConsola();
 * const gitInfo = getGitInfo(logger);
 * // Logs git info or appropriate message if not available
 * ```
 */
export function getGitInfo(logger: ReturnType<typeof createConsola>): GitInfo | null {
  try {
    // First check if we're in a git repository
    const isGitRepo = execGitCommand('git rev-parse --is-inside-work-tree');
    if (!isGitRepo) {
      logger.info('ℹ️  Not in a git repository, skipping git information');
      return null;
    }

    const remoteUrl = getRemoteUrl();
    const repository = remoteUrl ? extractRepoName(remoteUrl) : undefined;

    const gitInfo = {
      repository,
      branch: getBranch() || undefined,
      commitSha: getCommitSha() || undefined,
      commitMessage: getCommitMessage() || undefined,
      commitAuthor: getCommitAuthor() || undefined,
      commitAuthorEmail: getCommitAuthorEmail() || undefined,
      commitDate: getCommitDate() || undefined,
      isDirty: isDirty(),
      remoteUrl: remoteUrl || undefined,
    };

    logger.info('📚 Git information captured:', {
      repository: gitInfo.repository,
      branch: gitInfo.branch,
      commitSha: gitInfo.commitSha?.substring(0, 7),
      isDirty: gitInfo.isDirty,
    });

    return gitInfo;
  } catch (error) {
    logger.warn('⚠️  Failed to capture git information:', error);
    return null;
  }
}

