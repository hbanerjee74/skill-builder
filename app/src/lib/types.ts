export interface DeviceFlowResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface DeviceFlowPollResult {
  status: "pending" | "complete" | "expired" | "error"
  token?: string
  error?: string
}

export interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
}

export interface AppSettings {
  anthropic_api_key: string | null
  github_token: string | null
  github_repo: string | null
  workspace_path: string | null
  auto_commit: boolean
  auto_push: boolean
}

export interface SkillSummary {
  name: string
  domain: string | null
  current_step: string | null
  status: string | null
  last_modified: string | null
}

export interface NodeStatus {
  available: boolean
  version: string | null
  meets_minimum: boolean
  error: string | null
}

export interface WorkflowStep {
  id: number
  name: string
  description: string
  status: "pending" | "in_progress" | "waiting_for_user" | "completed" | "error"
  agentModel?: string
}

export interface ParallelAgentResult {
  agent_id_a: string
  agent_id_b: string
}

export interface PackageResult {
  file_path: string
  size_bytes: number
}

// --- Git Types ---

export interface PullResult {
  commits_pulled: number
  up_to_date: boolean
}

export interface CommitResult {
  oid: string
  message: string
  changed_files: number
}

export interface GitDiff {
  files: GitDiffEntry[]
}

export interface GitDiffEntry {
  path: string
  status: string
  hunks?: DiffHunk[]
}

export interface DiffHunk {
  old_start: number
  old_lines: number
  new_start: number
  new_lines: number
  content: string
}

export interface GitLogEntry {
  oid: string
  message: string
  author: string
  timestamp: string
}

export interface GitFileStatusEntry {
  path: string
  status: string
}
