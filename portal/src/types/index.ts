// ADO API types
export interface BugAnalysisRequest {
  queryUrl: string;
  sprintStart?: string;
  sprintEnd?: string;
  patToken: string;
  useCopilot?: boolean;
  requestId?: string;
}

export interface BugDataRequest {
  queryUrl: string;
  sprintStart?: string;
  sprintEnd?: string;
  patToken: string;
}

export interface IterationInfo {
  pi: number;
  iteration: number;
  path: string;
}

export interface SprintInfo {
  pi: number;
  iteration: number;
}

export interface WorkItem {
  id: number;
  fields: {
    'System.Title': string;
    'System.Description'?: string;
    'System.State': string;
    'System.CreatedDate': string;
    'System.ClosedDate'?: string;
    'System.AssignedTo'?: { displayName: string };
    'Microsoft.VSTS.Common.Priority'?: number;
    'Microsoft.VSTS.Common.Severity'?: string;
    'System.AreaPath'?: string;
    'System.IterationPath'?: string;
  };
  relations?: Relation[];
}

export interface Relation {
  rel: string;
  url: string;
}

export interface PullRequest {
  id: number | string;
  title: string;
  description: string;
  createdBy: string;
  creationDate: string;
  closedDate?: string;
  status: string;
  commits: Commit[];
  changes: Change[];
  repositoryId?: string;
  repositoryName?: string;
}

export interface Commit {
  commitId: string;
  comment: string;
  author: string;
  committer: string;
  date: string;
}

export interface Change {
  item: string;
  changeType: string;
  sourceServerItem: string;
  targetServerItem: string;
}

export type AnalysisMethod = 'copilot' | 'rule-based';

export interface BugAnalysisResult {
  id: number;
  title: string;
  description: string;
  state: string;
  created_date: string;
  closed_date: string;
  assigned_to: string;
  priority: string;
  severity: string;
  area_path: string;
  classification: 'PROGRESSION' | 'REGRESSION' | 'UNCLEAR';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  pr_count: number;
  pr_titles: string;
  linked_prs: PullRequest[];
  issue_type?: {
    type: 'coding_error' | 'merge_issue' | 'integration_issue' | 'unclear';
    confidence: 'high' | 'medium' | 'low';
    indicators: string[];
  };
  bug_origin?: {
    introduced_by: string;
    introduced_in_commit: string;
    introduced_date: string;
    fixed_by: string;
    files_affected: string[];
  };
  git_signals?: {
    repoName: string;
    totalFiles: number;
    inputFiles: number;
    recentFiles: number;
    recentCommits: number;
    newFiles: number;
    latestChange?: string;
    notes?: string;
  };
  /** How this result was produced */
  analysisMethod?: AnalysisMethod;
  /** True when this result was served from the persistent cache (not freshly analysed) */
  fromCache?: boolean;
  /** ISO timestamp of when the analysis was last run */
  analyzedAt?: string;
}

export interface BugDataResult {
  id: number;
  title: string;
  description: string;
  state: string;
  created_date: string;
  closed_date: string;
  assigned_to: string;
  priority: string;
  severity: string;
  area_path: string;
  pr_count: number;
  pr_titles: string;
  linked_prs: PullRequest[];
  issue_type?: {
    type: 'coding_error' | 'merge_issue' | 'integration_issue' | 'unclear';
    confidence: 'high' | 'medium' | 'low';
    indicators: string[];
  };
  bug_origin?: {
    introduced_by: string;
    introduced_in_commit: string;
    introduced_date: string;
    fixed_by: string;
    files_affected: string[];
  };
}

export interface BugDataResponse {
  results: BugDataResult[];
  sprintStart: string;
  sprintEnd: string;
  totalBugs: number;
  closedBugs: number;
}

export interface AnalysisSummary {
  total: number;
  progressions: number;
  regressions: number;
  unclear: number;
  progressionRate: number;
  regressionRate: number;
}

// RCA types
export interface RCAInitialAnalysis {
  observation: string;
  suspectedCause: string;
  nextSteps: string[];
}

export interface RCAFinalization {
  issueType: 'Coding issue' | 'Merging issue' | 'Integration issue' | 'Requirements gap';
  scopeOfIssue: string;
  fixApplied: string;
  changedArea: string[];
  impactOnOtherComponents: boolean;
  impactDetails?: string;
  relatedWorkItemId: string;
}

export interface RCAReport {
  bugId: number;
  bugTitle: string;
  initialAnalysis: RCAInitialAnalysis;
  finalization: RCAFinalization;
  generatedAt: string;
}

export interface RCAGenerationRequest {
  bugId: number;
  bugData: BugAnalysisResult;
  useCopilot?: boolean;
}

// ─── Story Extractor types ────────────────────────────────────────────────────

export interface StoryUserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
}

export interface StoryModuleRecord {
  moduleName: string;
  lastAnalyzedAt: string | null;
  epicName: string;
  userStories: StoryUserStory[];
}

export interface StoryPersistenceStore {
  modules: Record<string, StoryModuleRecord>;
}

export interface StoryBedrockAnalysisResult {
  epicName: string;
  userStories: Array<{
    title: string;
    description: string;
    acceptanceCriteria: string[];
  }>;
}

export interface StoryParsedModuleCode {
  files: string[];
  codeContent: string;
  totalFiles: number;
  totalChars: number;
  /** When the module exceeds the single-batch limit, the content is split into
   *  multiple batches. Each entry is a self-contained code string ≤ 400 K chars.
   *  If the module fits in one batch this array has exactly one element. */
  batches: string[];
  totalBatches: number;
}

export type StoryAnalysisStatus =
  | 'idle'
  | 'discovering'
  | 'parsing'
  | 'analyzing'
  | 'complete'
  | 'error';
