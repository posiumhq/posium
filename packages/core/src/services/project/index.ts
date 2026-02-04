/**
 * ProjectService exports.
 */

export { createProjectService, type ProjectService } from "./project.service.js";
export type {
  Project,
  ProjectWithStats,
  ProjectStats,
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsOptions,
  ProjectHealth,
  ProjectSummary,
  ProjectWithHealth,
} from "./project.types.js";
