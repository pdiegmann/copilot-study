/**
 * GitLab Task Type Integration
 *
 * Integrates GitLab task types with the main application, providing a unified interface
 * for task processing, type checking, and task type metadata. This module acts as a
 * bridge between the core processor and the GitLab-specific logic, ensuring that all
 * task types, descriptions, and processors are consistently managed.
 *
 * Exports:
 * - Factory for creating a GitLabTaskProcessor
 * - Type guard for GitLab tasks
 * - Task type description lookup
 * - List of all available GitLab task types and their descriptions
 */

/**
 * Internal dependencies for GitLab task integration.
 * These imports provide type definitions and core logic for task processing.
 */
import { type Task } from '../types/task';
import { GitLabTaskType } from '../types/gitlab-tasks';
import { GitLabTaskProcessor } from './gitlab-processor';
import { Anonymizer } from '../utils/anonymizer';
import { LookupDatabase } from '../utils/lookup-db';
import { DataStorage } from '../storage/data-storage';
import type { UnixSocketManager } from '../core/crawler-socket';
import { GitLabTaskTypeDescriptions } from "./gitlab-tasks";

/**
 * Factory function to create a GitLab task processor.
 *
 * @param options - Required dependencies for the processor:
 *   - socketManager: UnixSocketManager instance for socket communication
 *   - anonymizer: Anonymizer instance for privacy-preserving operations
 *   - lookupDb: LookupDatabase instance for ID mapping
 *   - dataStorage: DataStorage instance for persistent storage
 * @returns A new instance of GitLabTaskProcessor
 */
export function createGitLabTaskProcessor(options: {
  socketManager: UnixSocketManager;
  anonymizer: Anonymizer;
  lookupDb: LookupDatabase;
  dataStorage: DataStorage;
}): GitLabTaskProcessor {
  return new GitLabTaskProcessor(options);
}

/**
 * Type guard to check if a given task is a GitLab task.
 *
 * @param task - The task object to check (must have a 'type' property)
 * @returns True if the task type is a valid GitLabTaskType, false otherwise
 */
export function isGitLabTask(task: Task): boolean {
  return Object.values(GitLabTaskType).includes(task.type as GitLabTaskType);
}

/**
 * Get a human-readable description for a given GitLab task type.
 *
 * @param taskType - The string task type to describe (should match a GitLabTaskType)
 * @returns The description if available, otherwise 'Unknown task type'
 */
export function getTaskTypeDescription(taskType: string): string {
  // Check if the provided type matches a known GitLabTaskType
  if (Object.values(GitLabTaskType).map(x => x.toString()).includes(taskType)) {
    const tt = GitLabTaskType[taskType as keyof typeof GitLabTaskType];
    if (Object.keys(GitLabTaskTypeDescriptions).includes(tt)) {
      return GitLabTaskTypeDescriptions[tt as keyof typeof GitLabTaskTypeDescriptions];
    }
  }
  return 'Unknown task type';
}

/**
 * Get all available GitLab task types and their descriptions.
 *
 * @returns Array of objects with type and description for each GitLab task type.
 *          Useful for UI dropdowns, validation, or documentation.
 */
export function getAllGitLabTaskTypes(): { type: string; description: string }[] {
  return Object.values(GitLabTaskType).map(type => ({
    type,
    description: getTaskTypeDescription(type)
  }));
}
