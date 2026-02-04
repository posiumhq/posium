/**
 * Pagination helper functions.
 */

import type { PaginationOptions, PaginationMeta } from "./types.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

/**
 * Normalized pagination values ready for database queries.
 */
export interface NormalizedPagination {
  /** Zero-based offset for SQL OFFSET clause */
  offset: number;
  /** Number of items to fetch (SQL LIMIT clause) */
  limit: number;
  /** Normalized page number (1-indexed) */
  page: number;
  /** Normalized items per page */
  perPage: number;
}

/**
 * Normalize pagination options to safe, valid values.
 *
 * - Ensures page is at least 1
 * - Ensures perPage is between 1 and MAX_PER_PAGE
 * - Calculates offset for SQL queries
 */
export function normalizePagination(
  options: PaginationOptions
): NormalizedPagination {
  const page = Math.max(1, Math.floor(options.page ?? DEFAULT_PAGE));
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, Math.floor(options.perPage ?? DEFAULT_PER_PAGE))
  );
  const offset = (page - 1) * perPage;

  return { offset, limit: perPage, page, perPage };
}

/**
 * Build pagination metadata from query results.
 *
 * @param page - Current page (1-indexed)
 * @param perPage - Items per page
 * @param total - Total number of items matching the query
 */
export function buildPaginationMeta(
  page: number,
  perPage: number,
  total: number
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return {
    page,
    perPage,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}
