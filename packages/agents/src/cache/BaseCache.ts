import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { LoggerType } from "../browser/types/logger.js";

export interface CacheEntry {
  timestamp: number;
  data: unknown;
  requestId: string;
}

export interface CacheStore {
  [key: string]: CacheEntry;
}

export class BaseCache<T extends CacheEntry> {
  private readonly CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds
  private readonly CLEANUP_PROBABILITY = 0.01; // 1% chance

  protected cacheDir: string;
  protected cacheFile: string;
  protected lockFile: string;
  protected logger: LoggerType;

  private readonly LOCK_TIMEOUT_MS = 1_000;
  protected lockAcquired = false;
  protected lockAcquireFailures = 0;

  // Added for request ID tracking
  protected requestIdToUsedHashes: { [key: string]: string[] } = {};

  constructor(
    logger: LoggerType,
    cacheDir: string = path.join(process.cwd(), "tmp", ".cache"),
    cacheFile: string = "cache.json",
  ) {
    this.logger = logger;
    this.cacheDir = cacheDir;
    this.cacheFile = path.join(cacheDir, cacheFile);
    this.lockFile = path.join(cacheDir, "cache.lock");
    this.ensureCacheDirectory();
    this.setupProcessHandlers();
  }

  private setupProcessHandlers(): void {
    const releaseLockAndExit = () => {
      this.releaseLock();
      process.exit();
    };

    process.on("exit", releaseLockAndExit);
    process.on("SIGINT", releaseLockAndExit);
    process.on("SIGTERM", releaseLockAndExit);
    process.on("uncaughtException", (err) => {
      this.logger.debug(
        { category: "base_cache", error: err.message, trace: err.stack },
        "uncaught exception",
      );
      if (this.lockAcquired) {
        releaseLockAndExit();
      }
    });
  }

  protected ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      this.logger.debug(
        { category: "base_cache", cacheDir: this.cacheDir },
        "created cache directory",
      );
    }
  }

  protected createHash(data: unknown): string {
    const hash = crypto.createHash("sha256");
    return hash.update(JSON.stringify(data)).digest("hex");
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async acquireLock(): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < this.LOCK_TIMEOUT_MS) {
      try {
        if (fs.existsSync(this.lockFile)) {
          const lockAge = Date.now() - fs.statSync(this.lockFile).mtimeMs;
          if (lockAge > this.LOCK_TIMEOUT_MS) {
            fs.unlinkSync(this.lockFile);
            this.logger.debug(
              { category: "base_cache" },
              "Stale lock file removed",
            );
          }
        }

        fs.writeFileSync(this.lockFile, process.pid.toString(), { flag: "wx" });
        this.lockAcquireFailures = 0;
        this.lockAcquired = true;
        this.logger.debug({ category: "base_cache" }, "Lock acquired");
        return true;
      } catch (e) {
        this.logger.debug(
          { category: "base_cache", error: String(e) },
          "error acquiring lock",
        );
        await this.sleep(5);
      }
    }
    this.logger.debug(
      { category: "base_cache" },
      "Failed to acquire lock after timeout",
    );
    this.lockAcquireFailures++;
    if (this.lockAcquireFailures >= 3) {
      this.logger.debug(
        { category: "base_cache" },
        "Failed to acquire lock 3 times in a row. Releasing lock manually.",
      );
      this.releaseLock();
    }
    return false;
  }

  public releaseLock(): void {
    try {
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile);
        this.logger.debug({ category: "base_cache" }, "Lock released");
      }
      this.lockAcquired = false;
    } catch (error) {
      this.logger.debug(
        { category: "base_cache", error: (error as Error).message, trace: (error as Error).stack },
        "error releasing lock",
      );
    }
  }

  /**
   * Cleans up stale cache entries that exceed the maximum age.
   */
  public async cleanupStaleEntries(): Promise<void> {
    if (!(await this.acquireLock())) {
      this.logger.debug(
        { category: "llm_cache" },
        "failed to acquire lock for cleanup",
      );
      return;
    }

    try {
      const cache = this.readCache();
      const now = Date.now();
      let entriesRemoved = 0;

      for (const [hash, entry] of Object.entries(cache)) {
        if (now - entry.timestamp > this.CACHE_MAX_AGE_MS) {
          delete cache[hash];
          entriesRemoved++;
        }
      }

      if (entriesRemoved > 0) {
        this.writeCache(cache);
        this.logger.debug(
          { category: "llm_cache", entriesRemoved },
          "cleaned up stale cache entries",
        );
      }
    } catch (error) {
      this.logger.debug(
        { category: "llm_cache", error: (error as Error).message, trace: (error as Error).stack },
        "error during cache cleanup",
      );
    } finally {
      this.releaseLock();
    }
  }

  protected readCache(): CacheStore {
    if (fs.existsSync(this.cacheFile)) {
      try {
        const data = fs.readFileSync(this.cacheFile, "utf-8");
        return JSON.parse(data) as CacheStore;
      } catch (error) {
        this.logger.debug(
          { category: "base_cache", error: (error as Error).message, trace: (error as Error).stack },
          "error reading cache file. resetting cache.",
        );
        this.resetCache();
        return {};
      }
    }
    return {};
  }

  protected writeCache(cache: CacheStore): void {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2));
      this.logger.debug({ category: "base_cache" }, "Cache written to file");
    } catch (error) {
      this.logger.debug(
        { category: "base_cache", error: (error as Error).message, trace: (error as Error).stack },
        "error writing cache file",
      );
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Retrieves data from the cache based on the provided options.
   * @param hashObj - The options used to generate the cache key.
   * @param requestId - The identifier for the current request.
   * @returns The cached data if available, otherwise null.
   */
  public async get(
    hashObj: Record<string, unknown> | string,
    requestId: string,
  ): Promise<T["data"] | null> {
    if (!(await this.acquireLock())) {
      this.logger.debug(
        { category: "base_cache" },
        "Failed to acquire lock for getting cache",
      );
      return null;
    }

    try {
      const hash = this.createHash(hashObj);
      const cache = this.readCache();

      if (cache[hash]) {
        this.trackRequestIdUsage(requestId, hash);
        return cache[hash].data;
      }
      return null;
    } catch (error) {
      this.logger.debug(
        { category: "base_cache", error: (error as Error).message, trace: (error as Error).stack },
        "error getting cache. resetting cache.",
      );

      this.resetCache();
      return null;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Stores data in the cache based on the provided options and requestId.
   * @param hashObj - The options used to generate the cache key.
   * @param data - The data to be cached.
   * @param requestId - The identifier for the cache entry.
   */
  public async set(
    hashObj: Record<string, unknown>,
    data: T["data"],
    requestId: string,
  ): Promise<void> {
    if (!(await this.acquireLock())) {
      this.logger.debug(
        { category: "base_cache" },
        "Failed to acquire lock for setting cache",
      );
      return;
    }

    try {
      const hash = this.createHash(hashObj);
      const cache = this.readCache();
      cache[hash] = {
        data,
        timestamp: Date.now(),
        requestId,
      };

      this.writeCache(cache);
      this.trackRequestIdUsage(requestId, hash);
    } catch (error) {
      this.logger.debug(
        { category: "base_cache", error: (error as Error).message, trace: (error as Error).stack },
        "error setting cache. resetting cache.",
      );

      this.resetCache();
    } finally {
      this.releaseLock();

      if (Math.random() < this.CLEANUP_PROBABILITY) {
        this.cleanupStaleEntries();
      }
    }
  }

  public async delete(hashObj: Record<string, unknown>): Promise<void> {
    if (!(await this.acquireLock())) {
      this.logger.debug(
        { category: "base_cache" },
        "Failed to acquire lock for removing cache entry",
      );
      return;
    }

    try {
      const hash = this.createHash(hashObj);
      const cache = this.readCache();

      if (cache[hash]) {
        delete cache[hash];
        this.writeCache(cache);
      } else {
        this.logger.debug(
          { category: "base_cache" },
          "Cache entry not found to delete",
        );
      }
    } catch (error) {
      this.logger.debug(
        { category: "base_cache", error: (error as Error).message, trace: (error as Error).stack },
        "error removing cache entry",
      );
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Tracks the usage of a hash with a specific requestId.
   * @param requestId - The identifier for the current request.
   * @param hash - The cache key hash.
   */
  protected trackRequestIdUsage(requestId: string, hash: string): void {
    this.requestIdToUsedHashes[requestId] ??= [];
    this.requestIdToUsedHashes[requestId].push(hash);
  }

  /**
   * Deletes all cache entries associated with a specific requestId.
   * @param requestId - The identifier for the request whose cache entries should be deleted.
   */
  public async deleteCacheForRequestId(requestId: string): Promise<void> {
    if (!(await this.acquireLock())) {
      this.logger.debug(
        { category: "base_cache" },
        "Failed to acquire lock for deleting cache",
      );
      return;
    }
    try {
      const cache = this.readCache();
      const hashes = this.requestIdToUsedHashes[requestId] ?? [];
      let entriesRemoved = 0;
      for (const hash of hashes) {
        if (cache[hash]) {
          delete cache[hash];
          entriesRemoved++;
        }
      }
      if (entriesRemoved > 0) {
        this.writeCache(cache);
      } else {
        this.logger.debug(
          { category: "base_cache", requestId },
          "no cache entries found for requestId",
        );
      }
      // Remove the requestId from the mapping after deletion
      delete this.requestIdToUsedHashes[requestId];
    } catch (error) {
      this.logger.debug(
        { category: "base_cache", error: (error as Error).message, trace: (error as Error).stack, requestId },
        "error deleting cache for requestId",
      );
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Resets the entire cache by clearing the cache file.
   */
  public resetCache(): void {
    try {
      fs.writeFileSync(this.cacheFile, "{}");
      this.requestIdToUsedHashes = {}; // Reset requestId tracking
    } catch (error) {
      this.logger.debug(
        { category: "base_cache", error: (error as Error).message, trace: (error as Error).stack },
        "error resetting cache",
      );
    } finally {
      this.releaseLock();
    }
  }
}
