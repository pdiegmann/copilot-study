/**
 * GitLab API Entity Types
 * 
 * This file contains type definitions for GitLab entities that are relevant
 * for the scientific study on digital traces in GitLab.
 */

// Base entity types
export interface BaseEntity {
  id: string;
  created_at?: string;
  updated_at?: string;
}

// Area-related types (for discovery)
export interface Area extends BaseEntity {
  path: string;
  name: string;
  type: 'group' | 'project' | 'repository';
  parent_path?: string;
}

// Group-related types
export interface Group extends BaseEntity {
  name: string;
  path: string;
  full_path: string;
  description?: string;
  visibility: string;
  parent_id?: string;
}

// Project-related types
export interface Project extends BaseEntity {
  name: string;
  path: string;
  path_with_namespace: string;
  description?: string;
  visibility: string;
  namespace: {
    id: string;
    name: string;
    path: string;
    full_path: string;
    kind: string;
  };
  default_branch?: string;
  created_at: string;
  last_activity_at: string;
}

// Repository-related types
export interface Repository extends BaseEntity {
  project_id: string;
  root_ref?: string; // Default branch
}

// Branch-related types
export interface Branch extends BaseEntity {
  name: string;
  commit: Commit;
  merged: boolean;
  protected: boolean;
  developers_can_push: boolean;
  developers_can_merge: boolean;
  can_push: boolean;
  default: boolean;
  web_url: string;
}

// Commit-related types
export interface Commit extends BaseEntity {
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committer_email: string;
  committed_date: string;
  web_url: string;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
}

// Issue-related types
export interface Issue extends BaseEntity {
  iid: string; // Internal ID within project
  project_id: string;
  title: string;
  description?: string;
  state: 'opened' | 'closed';
  labels?: string[];
  milestone?: Milestone;
  assignees?: User[];
  author: User;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  closed_by?: User;
  due_date?: string;
  web_url: string;
  time_stats: {
    time_estimate: number;
    total_time_spent: number;
    human_time_estimate?: string;
    human_total_time_spent?: string;
  };
}

// Merge request-related types
export interface MergeRequest extends BaseEntity {
  iid: string; // Internal ID within project
  project_id: string;
  title: string;
  description?: string;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  source_branch: string;
  target_branch: string;
  source_project_id: string;
  target_project_id: string;
  author: User;
  assignees?: User[];
  created_at: string;
  updated_at: string;
  merged_at?: string;
  closed_at?: string;
  merged_by?: User;
  closed_by?: User;
  web_url: string;
  time_stats: {
    time_estimate: number;
    total_time_spent: number;
    human_time_estimate?: string;
    human_total_time_spent?: string;
  };
}

// Epic-related types
export interface Epic extends BaseEntity {
  iid: string; // Internal ID within group
  group_id: string;
  title: string;
  description?: string;
  state: 'opened' | 'closed';
  author: User;
  created_at: string;
  updated_at: string;
  start_date?: string;
  end_date?: string;
  web_url: string;
}

// Milestone-related types
export interface Milestone extends BaseEntity {
  iid: string; // Internal ID within project or group
  title: string;
  description?: string;
  state: 'active' | 'closed';
  created_at: string;
  updated_at: string;
  due_date?: string;
  start_date?: string;
  web_url: string;
}

// User-related types
export interface User extends BaseEntity {
  username: string;
  name: string;
  state: 'active' | 'blocked';
  web_url: string;
  avatar_url?: string;
}

// CI/CD Pipeline-related types
export interface Pipeline extends BaseEntity {
  project_id: string;
  sha: string;
  ref: string;
  status: 'created' | 'waiting_for_resource' | 'preparing' | 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped' | 'manual' | 'scheduled';
  source: string;
  created_at: string;
  updated_at: string;
  web_url: string;
}

// CI/CD Job-related types
export interface Job extends BaseEntity {
  pipeline_id: string;
  status: 'created' | 'waiting_for_resource' | 'preparing' | 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped' | 'manual' | 'scheduled';
  stage: string;
  name: string;
  ref: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  duration?: number;
  user: User;
  commit: Commit;
  web_url: string;
}

// Release-related types
export interface Release extends BaseEntity {
  tag_name: string;
  name: string;
  description?: string;
  created_at: string;
  released_at: string;
  author: User;
  commit: Commit;
  assets?: {
    count: number;
    links: {
      id: string;
      name: string;
      url: string;
      direct_asset_url: string;
    }[];
  };
}

// Event-related types
export interface Event extends BaseEntity {
  project_id?: string;
  action_name: string;
  target_id?: string;
  target_type?: string;
  author_id: string;
  author: User;
  created_at: string;
  note?: {
    id: string;
    body: string;
    attachment?: string;
    author: User;
    created_at: string;
    updated_at: string;
    system: boolean;
    noteable_id: string;
    noteable_type: string;
  };
  push_data?: {
    commit_count: number;
    action: string;
    ref_type: string;
    commit_from: string;
    commit_to: string;
    ref: string;
    commit_title: string;
  };
}

// Sprint (Iteration) related types
export interface Sprint extends BaseEntity {
  iid: string;
  title: string;
  description?: string;
  state: 'upcoming' | 'started' | 'closed';
  created_at: string;
  updated_at: string;
  start_date: string;
  due_date: string;
  web_url: string;
}
