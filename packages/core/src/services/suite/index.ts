/**
 * SuiteService exports.
 */

export { createSuiteService, type SuiteService } from "./suite.service.js";
export type {
  Suite,
  SuiteWithStats,
  SuiteStatus,
  SuiteTestStats,
  SuiteSortColumn,
  SuiteFilters,
  ListSuitesOptions,
  ListSuitesResult,
  CreateSuiteInput,
  UpdateSuiteInput,
  SuiteOverviewTestStats,
  FailingTest,
  SuiteRecentRun,
  DailyRunData,
  SuiteOverviewStats,
} from "./suite.types.js";
