/**
 * Pagination types for server-side pagination across all services.
 */

/**
 * Standard pagination options for list operations.
 */
export interface PaginationOptions {
  /** Page number (1-indexed). Default: 1 */
  page?: number;
  /** Items per page. Default: 10, Max: 100 */
  perPage?: number;
}

/**
 * Standard sorting options for list operations.
 */
export interface SortingOptions<T extends string = string> {
  /** Column to sort by */
  sortBy?: T;
  /** Sort direction */
  sortOrder?: "asc" | "desc";
}

/**
 * Date range filter for timestamp columns.
 */
export interface DateRangeFilter {
  /** Start of date range (inclusive) */
  from?: Date;
  /** End of date range (inclusive) */
  to?: Date;
}

/**
 * Pagination metadata returned with list results.
 */
export interface PaginationMeta {
  /** Current page (1-indexed) */
  page: number;
  /** Items per page */
  perPage: number;
  /** Total number of items matching the query */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there are more pages after the current one */
  hasMore: boolean;
}

/**
 * Generic paginated response wrapper.
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}
