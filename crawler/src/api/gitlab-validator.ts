/**
 * GitLab Task Type Validator
 *
 * Provides validation and testing utilities for GitLab task types to ensure
 * proper endpoint usage, data collection flows, and integration correctness.
 * Includes mock classes for isolated testing and a validator class for automated checks.
 */

import { type Task, UpdateType } from '../types/task';
import { GitLabTaskType } from '../types/gitlab-tasks';
import { GitLabTaskProcessor } from './gitlab-processor';
import { getLogger } from "@logtape/logtape";
const logger = getLogger(["api"]);

/* ---------------------------------------------------------------------------
 * Mock implementations for testing
 * ------------------------------------------------------------------------- */
/**
 * Mock UnixSocketManager for capturing updates during validation.
 */
class MockUnixSocketManager {
  public updates: any[] = [];
  
  sendUpdate(update: any): void {
    this.updates.push(update);
    logger.info('Update sent:', update);
  }
}

/**
 * Mock Anonymizer for simulating anonymization logic.
 */
class MockAnonymizer {
  anonymizeObject(obj: any): any {
    // Simple mock that just adds an "anonymized" flag
    return { ...obj, anonymized: true };
  }
}

/**
 * Mock LookupDatabase for testing initialization and save flows.
 */
class MockLookupDb {
  async initialize(): Promise<void> {}
  async save(): Promise<void> {}
}

/**
 * Mock DataStorage for capturing stored data during validation.
 */
class MockDataStorage {
  public storedData: Record<string, Record<string, any[]>> = {};
  
  async initialize(): Promise<void> {}
  
  async storeData(originPath: string, itemType: string, items: any[]): Promise<void> {
    if (!this.storedData[originPath]) {
      this.storedData[originPath] = {};
    }
    
    if (!this.storedData[originPath][itemType]) {
      this.storedData[originPath][itemType] = [];
    }
    
    this.storedData[originPath][itemType].push(...items);
    logger.info(`Stored ${items.length} items of type ${itemType} in ${originPath}`);
  }
}

/* ---------------------------------------------------------------------------
 * Mock API responses for testing
 * ------------------------------------------------------------------------- */
const mockApiResponses: Record<string, any> = {
  // Groups
  '/api/v4/groups': [
    { id: 1, name: 'Group 1', full_path: 'group-1' },
    { id: 2, name: 'Group 2', full_path: 'group-2' }
  ],
  
  // Projects
  '/api/v4/projects': [
    { 
      id: 101, 
      name: 'Project 1', 
      path_with_namespace: 'group-1/project-1',
      namespace: { id: 1, name: 'Group 1', full_path: 'group-1', kind: 'group' }
    },
    { 
      id: 102, 
      name: 'Project 2', 
      path_with_namespace: 'group-2/project-2',
      namespace: { id: 2, name: 'Group 2', full_path: 'group-2', kind: 'group' }
    }
  ],
  
  // Group projects
  '/api/v4/groups/1/projects': [
    { 
      id: 101, 
      name: 'Project 1', 
      path_with_namespace: 'group-1/project-1',
      namespace: { id: 1, name: 'Group 1', full_path: 'group-1', kind: 'group' }
    }
  ],
  '/api/v4/groups/2/projects': [
    { 
      id: 102, 
      name: 'Project 2', 
      path_with_namespace: 'group-2/project-2',
      namespace: { id: 2, name: 'Group 2', full_path: 'group-2', kind: 'group' }
    }
  ],
  
  // Branches
  '/api/v4/projects/101/repository/branches': [
    { name: 'main', commit: { id: 'abc123', short_id: 'abc123', title: 'Initial commit' } }
  ],
  '/api/v4/projects/102/repository/branches': [
    { name: 'main', commit: { id: 'def456', short_id: 'def456', title: 'Initial commit' } }
  ],
  
  // Commits
  '/api/v4/projects/101/repository/commits': [
    { 
      id: 'abc123', 
      short_id: 'abc123', 
      title: 'Initial commit',
      message: 'Initial commit',
      author_name: 'John Doe',
      author_email: 'john@example.com',
      authored_date: '2023-01-01T00:00:00Z',
      committer_name: 'John Doe',
      committer_email: 'john@example.com',
      committed_date: '2023-01-01T00:00:00Z',
      stats: { additions: 100, deletions: 0, total: 100 }
    }
  ],
  
  // Issues
  '/api/v4/projects/101/issues': [
    {
      id: 1001,
      iid: 1,
      title: 'Issue 1',
      description: 'Description for issue 1',
      state: 'opened',
      created_at: '2023-01-02T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      author: { id: 201, name: 'Jane Smith', username: 'jane' },
      assignees: [{ id: 202, name: 'Bob Johnson', username: 'bob' }],
      time_stats: { time_estimate: 3600, total_time_spent: 1800 }
    }
  ],
  
  // Merge requests
  '/api/v4/projects/101/merge_requests': [
    {
      id: 2001,
      iid: 1,
      title: 'Merge request 1',
      description: 'Description for MR 1',
      state: 'opened',
      created_at: '2023-01-03T00:00:00Z',
      updated_at: '2023-01-03T00:00:00Z',
      source_branch: 'feature',
      target_branch: 'main',
      author: { id: 201, name: 'Jane Smith', username: 'jane' },
      assignees: [{ id: 202, name: 'Bob Johnson', username: 'bob' }],
      time_stats: { time_estimate: 7200, total_time_spent: 3600 }
    }
  ],
  
  // Pipelines
  '/api/v4/projects/101/pipelines': [
    {
      id: 3001,
      iid: 1,
      sha: 'abc123',
      ref: 'main',
      status: 'success',
      created_at: '2023-01-04T00:00:00Z',
      updated_at: '2023-01-04T01:00:00Z',
      user: { id: 201, name: 'Jane Smith', username: 'jane' }
    }
  ],
  
  // Jobs
  '/api/v4/projects/101/pipelines/3001/jobs': [
    {
      id: 4001,
      name: 'build',
      stage: 'build',
      status: 'success',
      created_at: '2023-01-04T00:00:00Z',
      started_at: '2023-01-04T00:00:05Z',
      finished_at: '2023-01-04T00:10:00Z',
      duration: 595,
      user: { id: 201, name: 'Jane Smith', username: 'jane' }
    }
  ],
  
  // Events
  '/api/v4/projects/101/events': [
    {
      id: 5001,
      project_id: 101,
      action_name: 'pushed',
      target_id: null,
      target_type: null,
      author_id: 201,
      author: { id: 201, name: 'Jane Smith', username: 'jane' },
      created_at: '2023-01-05T00:00:00Z',
      push_data: {
        commit_count: 1,
        action: 'pushed',
        ref_type: 'branch',
        commit_from: 'abc123',
        commit_to: 'abc123',
        ref: 'main',
        commit_title: 'Initial commit'
      }
    }
  ]
};

/**
 * Mock fetch implementation for testing.
 * Simulates API responses for various endpoints.
 */
async function mockFetch(url: string, options: any = {}): Promise<any> {
  // Extract the path from the URL
  const urlObj = new URL(url);
  const path = urlObj.pathname + urlObj.search;
  
  // Find the matching mock response
  const exactMatch = mockApiResponses[path];
  if (exactMatch) {
    return {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'RateLimit-Limit') return '100';
          if (name === 'RateLimit-Remaining') return '99';
          if (name === 'RateLimit-Reset') return '60';
          return null;
        }
      },
      json: async () => exactMatch
    };
  }
  
  // Try to find a pattern match
  for (const mockPath in mockApiResponses) {
    // Replace path parameters with regex patterns
    const regexPattern = mockPath.replace(/:[a-zA-Z_]+/g, '[^/]+');
    const regex = new RegExp(`^${regexPattern}$`);
    
    if (regex.test(path)) {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            if (name === 'RateLimit-Limit') return '100';
            if (name === 'RateLimit-Remaining') return '99';
            if (name === 'RateLimit-Reset') return '60';
            return null;
          }
        },
        json: async () => mockApiResponses[mockPath]
      };
    }
  }
  
  // No match found
  return {
    ok: false,
    status: 404,
    statusText: 'Not Found',
    headers: {
      get: () => null
    },
    json: async () => ({ error: 'Not found' })
  };
}

/* ---------------------------------------------------------------------------
 * Validator class for GitLab task types
 * ------------------------------------------------------------------------- */
/**
 * GitLabTaskValidator
 *
 * Provides automated validation for all supported GitLab task types using mock dependencies.
 * Responsible for running validation flows, checking results, and summarizing outcomes.
 */
export class GitLabTaskValidator {
  private socketManager: MockUnixSocketManager;
  private anonymizer: MockAnonymizer;
  private lookupDb: MockLookupDb;
  private dataStorage: MockDataStorage;
  private processor: GitLabTaskProcessor;
  
  constructor() {
    // Initialize mock dependencies
    this.socketManager = new MockUnixSocketManager();
    this.anonymizer = new MockAnonymizer();
    this.lookupDb = new MockLookupDb();
    this.dataStorage = new MockDataStorage();
    
    // Initialize processor with mock dependencies
    this.processor = new GitLabTaskProcessor({
//      socketManager: this.socketManager as any,
      anonymizer: this.anonymizer as any,
      lookupDb: this.lookupDb as any,
      dataStorage: this.dataStorage as any
    });
    
    // Override global fetch with mock implementation
    global.fetch = mockFetch as any;
  }
  
  /**
   * Validate a specific GitLab task type using mock dependencies.
   *
   * @param taskType - The GitLabTaskType to validate
   * @returns True if validation passes, false otherwise
   */
  async validateTaskType(taskType: GitLabTaskType): Promise<boolean> {
    logger.info(`Validating task type: ${taskType}`);
    
    // Create a mock task
    const task: Task = {
      id: `test-${Date.now()}`,
      type: taskType,
      credentials: {
        accessToken: 'mock-token'
      },
      apiEndpoint: 'https://gitlab.example.com',
      options: {
        id: '101',
        fullPath: 'group-1/project-1',
        path: 'group-1/project-1',
        ref: 'main'
      }
    };
    
    // Reset mock state
    this.socketManager.updates = [];
    this.dataStorage.storedData = {};
    
    try {
      // Process the task
      await this.processor.processTask(task, (progress) => logger.warn("Unused progress callback:", progress));
      
      // Validate results
      const validationResult = this.validateResults(taskType);
      
      if (validationResult) {
        logger.info(`✅ Task type ${taskType} validated successfully`);
      } else {
        logger.error(`❌ Task type ${taskType} validation failed`);
      }
      
      return validationResult;
    } catch (error) {
      logger.error(`Error validating task type ${taskType}:`, {error});
      return false;
    }
  }
  
  /**
   * Validate all supported GitLab task types.
   *
   * @returns Record mapping each GitLabTaskType to its validation result (true/false)
   */
  async validateAllTaskTypes(): Promise<Record<GitLabTaskType, boolean>> {
    const results: Record<GitLabTaskType, boolean> = {} as Record<GitLabTaskType, boolean>;
    
    for (const taskType of Object.values(GitLabTaskType)) {
      results[taskType] = await this.validateTaskType(taskType);
    }
    
    return results;
  }
  
  /**
   * Validate the results of a task type validation.
   * Checks for updates, completion, and stored data.
   *
   * @param taskType - The GitLabTaskType being validated
   * @returns True if all validation criteria are met, false otherwise
   */
  private validateResults(taskType: GitLabTaskType): boolean {
    // Check if we received updates
    if (this.socketManager.updates.length === 0) {
      logger.error('No updates were sent');
      return false;
    }
    
    // Check if we received a completion update
    const completionUpdate = this.socketManager.updates.find(
      update => update.type === UpdateType.COMPLETION
    );
    
    if (!completionUpdate) {
      logger.error('No completion update was sent');
      return false;
    }
    
    // Check if we stored data
    const hasStoredData = Object.keys(this.dataStorage.storedData).length > 0;
    
    if (!hasStoredData) {
      logger.error('No data was stored');
      return false;
    }
    
    // For area discovery, check if we discovered areas
    if (taskType === GitLabTaskType.DISCOVER_AREAS) {
      const areaUpdates = this.socketManager.updates.filter(
        update => update.type === UpdateType.NEW_AREA
      );
      
      if (areaUpdates.length === 0) {
        logger.error('No area updates were sent');
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get a summary of the validation results.
   *
   * @returns A formatted string summarizing updates and stored data.
   */
  getValidationSummary(): string {
    let summary = 'GitLab Task Type Validation Summary:\n\n';
    
    // Summarize updates
    summary += `Updates sent: ${this.socketManager.updates.length}\n`;
    
    const updateTypes = this.socketManager.updates.reduce((acc, update) => {
      acc[update.type] = (acc[update.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    summary += 'Update types:\n';
    for (const [type, count] of Object.entries(updateTypes)) {
      summary += `  - ${type}: ${count}\n`;
    }
    
    // Summarize stored data
    summary += '\nStored data:\n';
    for (const [originPath, typeData] of Object.entries(this.dataStorage.storedData)) {
      summary += `  - ${originPath}:\n`;
      for (const [itemType, items] of Object.entries(typeData)) {
        summary += `    - ${itemType}: ${items.length} items\n`;
      }
    }
    
    return summary;
  }
}
