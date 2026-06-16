import axios from 'axios';
import { WorkItem, PullRequest, Commit } from '@/types';
import { logDebug, logWarn, logError } from '@/lib/logger';

export class ADOService {
  private patToken: string;
  private authHeader: string;

  constructor(patToken: string) {
    this.patToken = patToken;
    // Encode PAT token for Basic auth
    const authString = `:${patToken}`;
    let base64Token: string;
    
    try {
      // Try Buffer first (Node.js environment)
      base64Token = Buffer.from(authString).toString('base64');
    } catch (e) {
      // Fallback to btoa (browser environment)
      base64Token = btoa(authString);
    }
    
    this.authHeader = `Basic ${base64Token}`;
  }

  parseQueryUrl(queryUrl: string): { organization: string; project: string; queryId: string } {
    const pattern = /https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_queries\/query-edit\/([^/]+)\//;
    const match = queryUrl.match(pattern);

    if (!match) {
      throw new Error('Invalid ADO query URL format');
    }

    return {
      organization: match[1],
      project: match[2],
      queryId: match[3],
    };
  }

  async executeQuery(organization: string, project: string, queryId: string): Promise<WorkItem[]> {
    const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql/${queryId}?api-version=7.0`;

    try {
      const response = await axios.get(url, {
        headers: { 
          'Authorization': this.authHeader,
          'Content-Type': 'application/json'
        },
      });

      const workItemIds = response.data.workItems?.map((item: any) => item.id) || [];

      if (workItemIds.length === 0) {
        logWarn('No work items found in query response');
        return [];
      }

      return this.getWorkItemDetails(organization, project, workItemIds);
    } catch (error: any) {
      logError('Error executing query:', error.message);
      if (error.response) {
        logError('Error response status:', error.response.status);
        logError('Error response data:', error.response.data);
      }
      throw new Error(`Failed to execute ADO query: ${error.message}`);
    }
  }

  async getWorkItemDetails(organization: string, project: string, workItemIds: number[]): Promise<WorkItem[]> {
    const chunkSize = 200;
    const allWorkItems: WorkItem[] = [];

    for (let i = 0; i < workItemIds.length; i += chunkSize) {
      const chunk = workItemIds.slice(i, i + chunkSize);
      const idsParam = chunk.join(',');

      const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems`;
      const params = {
        ids: idsParam,
        'api-version': '7.0',
        $expand: 'relations',
      };

      try {
        const response = await axios.get(url, {
          headers: { Authorization: this.authHeader },
          params,
        });

        allWorkItems.push(...(response.data.value || []));
      } catch (error: any) {
        logError('Error fetching work item details:', error.message);
      }
    }

    return allWorkItems;
  }

  detectIssueType(pr: PullRequest): {
    type: 'coding_error' | 'merge_issue' | 'integration_issue' | 'unclear';
    confidence: 'high' | 'medium' | 'low';
    indicators: string[];
  } {
    const indicators: string[] = [];
    let type: 'coding_error' | 'merge_issue' | 'integration_issue' | 'unclear' = 'unclear';
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Handle cases with insufficient data
    if (!pr.commits || pr.commits.length === 0) {
      indicators.push('No commit data available');
      return { type, confidence, indicators };
    }

    // Analyze PR title and description for keywords
    const titleLower = pr.title.toLowerCase();
    const descLower = (pr.description || '').toLowerCase();
    const combined = titleLower + ' ' + descLower;

    // Check for merge-related indicators
    const mergeIndicators = {
      hasMergeCommit: pr.commits.some(c => {
        const comment = c.comment.toLowerCase();
        return comment.includes('merge') || 
               comment.includes('merged') ||
               comment.startsWith('merge branch') ||
               comment.includes('merge pull request');
      }),
      hasConflictMarkers: pr.changes.some(ch => 
        ch.item.includes('<<<<<<') || 
        ch.item.includes('>>>>>>') ||
        ch.item.includes('======')
      ),
      multipleAuthors: new Set(pr.commits.map(c => c.author)).size > 1,
      hasRevert: pr.commits.some(c => {
        const comment = c.comment.toLowerCase();
        return comment.includes('revert') ||
               comment.includes('rollback') ||
               comment.startsWith('revert "');
      }),
      hasMergeInTitle: combined.includes('merge conflict') || 
                      combined.includes('resolve conflict') ||
                      combined.includes('fix conflict'),
    };

    // Check for coding error indicators
    const codingIndicators = {
      singleAuthor: new Set(pr.commits.map(c => c.author)).size === 1,
      hasTests: pr.changes.some(ch => {
        const itemLower = ch.item.toLowerCase();
        return itemLower.includes('test') ||
               itemLower.includes('spec') ||
               itemLower.includes('.test.') ||
               itemLower.includes('.spec.');
      }),
      smallChangeSet: pr.changes.length > 0 && pr.changes.length <= 5,
      hasLogicFix: titleLower.includes('fix') || 
                  titleLower.includes('bug') ||
                  titleLower.includes('issue') ||
                  descLower.includes('fixed') ||
                  descLower.includes('resolved'),
      hasBugPattern: /\b(fix|bug|issue|defect|error)\b/i.test(combined),
    };

    // Check for integration issues
    const integrationIndicators = {
      multipleServices: pr.changes.some(ch => ch.item.toLowerCase().includes('service')) &&
                       pr.changes.some(ch => ch.item.toLowerCase().includes('api')),
      hasConfigChanges: pr.changes.some(ch => {
        const itemLower = ch.item.toLowerCase();
        return itemLower.includes('config') ||
               itemLower.endsWith('.json') ||
               itemLower.endsWith('.yml') ||
               itemLower.endsWith('.yaml') ||
               itemLower.includes('.env');
      }),
      crossTeamChanges: pr.changes.length > 10,
      hasIntegrationKeywords: combined.includes('integration') ||
                             combined.includes('api') ||
                             combined.includes('endpoint') ||
                             combined.includes('service'),
    };

    // Determine issue type based on indicators (prioritize merge > integration > coding)
    if (mergeIndicators.hasMergeCommit || mergeIndicators.hasConflictMarkers || mergeIndicators.hasMergeInTitle) {
      type = 'merge_issue';
      confidence = mergeIndicators.hasConflictMarkers ? 'high' : 
                   mergeIndicators.hasMergeInTitle ? 'high' : 'medium';
      
      if (mergeIndicators.hasMergeCommit) indicators.push('Contains merge commit');
      if (mergeIndicators.hasConflictMarkers) indicators.push('Has conflict markers');
      if (mergeIndicators.hasMergeInTitle) indicators.push('Merge conflict mentioned in title/description');
      if (mergeIndicators.multipleAuthors) indicators.push(`Multiple authors (${new Set(pr.commits.map(c => c.author)).size})`);
      if (mergeIndicators.hasRevert) indicators.push('Contains revert commit');
    } 
    else if (integrationIndicators.multipleServices || 
             (integrationIndicators.hasConfigChanges && integrationIndicators.hasIntegrationKeywords)) {
      type = 'integration_issue';
      confidence = (integrationIndicators.multipleServices && integrationIndicators.hasConfigChanges) ? 'high' : 'medium';
      
      if (integrationIndicators.multipleServices) indicators.push('Changes across multiple services/APIs');
      if (integrationIndicators.hasConfigChanges) indicators.push('Includes configuration changes');
      if (integrationIndicators.crossTeamChanges) indicators.push(`Large changeset (${pr.changes.length} files)`);
      if (integrationIndicators.hasIntegrationKeywords) indicators.push('Integration-related keywords detected');
    }
    else if (codingIndicators.hasLogicFix || codingIndicators.hasBugPattern) {
      type = 'coding_error';
      confidence = codingIndicators.hasTests ? 'high' : 'medium';
      
      if (codingIndicators.singleAuthor) indicators.push('Single author');
      if (codingIndicators.hasLogicFix) indicators.push('Contains bug fix');
      if (codingIndicators.hasTests) indicators.push('Includes test changes');
      if (codingIndicators.smallChangeSet) indicators.push(`Small changeset (${pr.changes.length} files)`);
    } else {
      // Default to coding error if we have commit data but no strong indicators
      if (pr.commits.length > 0) {
        type = 'coding_error';
        confidence = 'low';
        indicators.push('Default classification - no strong indicators found');
        if (pr.changes.length > 0) indicators.push(`${pr.changes.length} files changed`);
        if (pr.commits.length > 0) indicators.push(`${pr.commits.length} commits`);
      }
    }

    return { type, confidence, indicators };
  }

  async getLinkedPRs(organization: string, project: string, workItem: WorkItem): Promise<PullRequest[]> {
    const linkedPRs: PullRequest[] = [];
    const relations = workItem.relations || [];

    for (const relation of relations) {
      const relType = relation.rel || '';
      const url = relation.url || '';

      if (
        relType.includes('ArtifactLink') ||
        relType.includes('Branch') ||
        relType.includes('Pull Request') ||
        url.toLowerCase().includes('pullrequest') ||
        url.includes('git/pullRequests') ||
        url.includes('git/commits') ||
        url.includes('vstfs:///Git/')
      ) {
        // Handle PR links
        if (url.toLowerCase().includes('pullrequest') || url.includes('git/pullRequests')) {
          const prInfo = this.extractPRInfoFromUrl(url);
          if (prInfo) {
            const prDetails = await this.getPRDetails(organization, project, prInfo.prId);
            if (prDetails) {
              linkedPRs.push(prDetails);
            }
          }
        }
        // Handle direct commit links
        else if (url.includes('git/commits')) {
          const commitInfo = this.extractCommitInfoFromUrl(url);
          if (commitInfo) {
            const commitDetails = await this.getCommitDetails(
              organization,
              project,
              commitInfo.repoId,
              commitInfo.commitId
            );
            if (commitDetails) {
              const pseudoPR: PullRequest = {
                id: `commit-${commitInfo.commitId.substring(0, 8)}`,
                title: commitDetails.comment || 'Direct commit',
                description: commitDetails.comment || '',
                createdBy: commitDetails.author,
                creationDate: commitDetails.date,
                closedDate: commitDetails.date,
                status: 'completed',
                commits: [commitDetails],
                changes: [],
              };
              linkedPRs.push(pseudoPR);
            }
          }
        }
      }
    }

    return linkedPRs;
  }

  extractPRInfoFromUrl(url: string): { prId: number } | null {
    const decodedUrl = decodeURIComponent(url);
    const patterns = [
      /pullrequest\/(\d+)/i,
      /pullRequests\/(\d+)/i,
      /git\/pullRequests\/(\d+)/i,
      /pullRequestId=(\d+)/i,
      /vstfs:\/\/\/Git\/PullRequestId\/[^/]+\/[^/]+\/(\d+)/i,
      /PullRequestId\/[^/]+\/[^/]+\/(\d+)/i,
      /PullRequestId.*\/(\d+)$/i,
    ];

    for (const pattern of patterns) {
      const match = decodedUrl.match(pattern);
      if (match) {
        return { prId: parseInt(match[1], 10) };
      }
    }

    return null;
  }

  extractCommitInfoFromUrl(url: string): { repoId: string; commitId: string } | null {
    const decodedUrl = decodeURIComponent(url);
    const patterns = [
      /repositories\/([^/]+)\/commits\/([a-f0-9]+)/i,
      /git\/repositories\/([^/]+)\/commits\/([a-f0-9]+)/i,
      /commitId=([a-f0-9]+).*repositories\/([^/&]+)/i,
      /vstfs:\/\/\/Git\/Commit\/[^/]+\/([^/]+)\/([a-f0-9]+)/i,
      /Git\/Commit\/[^/]+\/([^/]+)\/([a-f0-9]+)/i,
      /Git\/Commit.*?\/([^/]+)\/([a-f0-9]+)$/i,
    ];

    for (const pattern of patterns) {
      const match = decodedUrl.match(pattern);
      if (match && match.length >= 3) {
        return {
          repoId: match[1],
          commitId: match[2],
        };
      }
    }

    return null;
  }

  async getCommitDetails(
    organization: string,
    project: string,
    repositoryId: string,
    commitId: string
  ): Promise<Commit | null> {
    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}/commits/${commitId}?api-version=7.0`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: this.authHeader },
      });

      return {
        commitId: response.data.commitId,
        comment: response.data.comment,
        author: response.data.author.name,
        committer: response.data.committer.name,
        date: response.data.committer.date,
      };
    } catch (error: any) {
      logError(`Error fetching commit ${commitId} details:`, error.message);
      return null;
    }
  }

  async getPRDetails(organization: string, project: string, prId: number): Promise<PullRequest | null> {
    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/pullrequests/${prId}?api-version=7.0`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: this.authHeader },
      });

      const prData = response.data;
      const commits = await this.getPRCommits(organization, project, prData.repository.id, prId);
      const changes = await this.getPRChanges(organization, project, prData.repository.id, prId);

      return {
        id: prData.pullRequestId,
        title: prData.title,
        description: prData.description || '',
        createdBy: prData.createdBy.displayName,
        creationDate: prData.creationDate,
        closedDate: prData.closedDate,
        status: prData.status,
        commits,
        changes,
        repositoryId: prData.repository?.id,
        repositoryName: prData.repository?.name,
      };
    } catch (error: any) {
      logError(`Error fetching PR ${prId} details:`, error.message);
      return null;
    }
  }

  async getPRCommits(organization: string, project: string, repositoryId: string, prId: number): Promise<Commit[]> {
    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}/pullrequests/${prId}/commits?api-version=7.0`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: this.authHeader },
      });

      return (response.data.value || []).map((commit: any) => ({
        commitId: commit.commitId,
        comment: commit.comment,
        author: commit.author.name,
        committer: commit.committer.name,
        date: commit.committer.date,
      }));
    } catch (error: any) {
      logError('Error fetching PR commits:', error.message);
      return [];
    }
  }

  async getPRChanges(organization: string, project: string, repositoryId: string, prId: number): Promise<any[]> {
    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}/pullrequests/${prId}/iterations/1/changes?api-version=7.0`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: this.authHeader },
      });

      return (response.data.changeEntries || []).map((change: any) => ({
        item: change.item?.path || '',
        changeType: change.changeType || '',
        sourceServerItem: change.sourceServerItem || '',
        targetServerItem: change.targetServerItem || '',
      }));
    } catch (error: any) {
      logError('Error fetching PR changes:', error.message);
      return [];
    }
  }

  async traceBugOrigin(
    organization: string,
    project: string,
    pr: PullRequest
  ): Promise<{
    introduced_by: string;
    introduced_in_commit: string;
    introduced_date: string;
    fixed_by: string;
    files_affected: string[];
  } | null> {
    try {
      if (!pr.commits || pr.commits.length === 0) return null;

      const prId = typeof pr.id === 'string' && pr.id.startsWith('commit-') ? null : pr.id;
      
      if (!prId) {
        logWarn('Bug linked to direct commit, not a PR - cannot trace full origin');
        return {
          introduced_by: 'Direct commit (no PR history)',
          introduced_in_commit: pr.commits[0]?.commitId?.substring(0, 8) || 'Unknown',
          introduced_date: pr.commits[0]?.date?.split('T')[0] || 'Unknown',
          fixed_by: pr.createdBy,
          files_affected: pr.changes.map(c => c.item),
        };
      }

      const prUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/pullrequests/${prId}?api-version=7.0`;
      const prResponse = await axios.get(prUrl, {
        headers: { Authorization: this.authHeader },
      });

      const repositoryId = prResponse.data.repository.id;
      const fixCommit = pr.commits[0];
      const filesAffected = pr.changes.map(c => c.item).filter(f => f);

      if (filesAffected.length === 0) {
        logWarn('No files affected in PR - cannot trace origin');
        return {
          introduced_by: 'No files in PR',
          introduced_in_commit: fixCommit.commitId.substring(0, 8),
          introduced_date: new Date(fixCommit.date).toISOString().split('T')[0],
          fixed_by: pr.createdBy,
          files_affected: [],
        };
      }

      const authorCounts: { [author: string]: { count: number; commits: any[] } } = {};
      const allAuthorCounts: { [author: string]: { count: number; commits: any[] } } = {};

      for (const filePath of filesAffected.slice(0, 10)) {
        try {
          const historyUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}/commits?searchCriteria.itemPath=${encodeURIComponent(filePath)}&searchCriteria.$top=20&api-version=7.0`;
          
          const historyResponse = await axios.get(historyUrl, {
            headers: { Authorization: this.authHeader },
          });

          const commits = historyResponse.data.value || [];
          const fixDate = new Date(fixCommit.date);
          const priorCommits = commits.filter((c: any) => {
            const commitDate = new Date(c.committer.date);
            return commitDate < fixDate && c.commitId !== fixCommit.commitId;
          });

          priorCommits.forEach((commit: any) => {
            const author = commit.author.name;
            
            // Track all authors including fixer
            if (!allAuthorCounts[author]) {
              allAuthorCounts[author] = { count: 0, commits: [] };
            }
            allAuthorCounts[author].count++;
            allAuthorCounts[author].commits.push(commit);
            
            // Track non-fixer authors separately
            if (author !== pr.createdBy) {
              if (!authorCounts[author]) {
                authorCounts[author] = { count: 0, commits: [] };
              }
              authorCounts[author].count++;
              authorCounts[author].commits.push(commit);
            }
          });
        } catch (error) {
          logWarn(`Failed to get history for file ${filePath}:`, (error as any).message);
          continue;
        }
      }

      // Prefer non-fixer authors, but fall back to all authors if none found
      const authors = Object.entries(authorCounts).length > 0 
        ? Object.entries(authorCounts) 
        : Object.entries(allAuthorCounts);
      
      if (authors.length === 0) {
        logWarn(`No prior commits found for bug origin trace. Files: ${filesAffected.length}`);
        return {
          introduced_by: 'Same as fixer (no prior authors)',
          introduced_in_commit: 'Unknown',
          introduced_date: 'Unknown',
          fixed_by: pr.createdBy,
          files_affected: filesAffected,
        };
      }

      authors.sort((a, b) => b[1].count - a[1].count);
      const likelyAuthor = authors[0];
      const mostRecentCommit = likelyAuthor[1].commits.sort(
        (a, b) => new Date(b.committer.date).getTime() - new Date(a.committer.date).getTime()
      )[0];

      return {
        introduced_by: likelyAuthor[0],
        introduced_in_commit: mostRecentCommit.commitId.substring(0, 8),
        introduced_date: new Date(mostRecentCommit.committer.date).toISOString().split('T')[0],
        fixed_by: pr.createdBy,
        files_affected: filesAffected,
      };
    } catch (error: any) {
      logError('Error tracing bug origin:', error.message);
      return null;
    }
  }

  extractIterationInfo(iterationPath: string): { pi: number; iteration: number; path: string } | null {
    if (!iterationPath) return null;

    // Pattern to match PI X\X.Y format
    const pattern = /PI\s+(\d+)\\(\d+)\.(\d+)/i;
    const match = iterationPath.match(pattern);

    if (match) {
      const pi = parseInt(match[1], 10);
      const piVerify = parseInt(match[2], 10);
      const iteration = parseInt(match[3], 10);

      if (pi === piVerify) {
        logDebug(`Extracted PI ${pi}, Iteration ${iteration} from ${iterationPath}`);
        return { pi, iteration, path: iterationPath };
      }
    }

    logDebug(`Could not parse iteration path: ${iterationPath}`);
    return null;
  }

  calculatePriorSprints(pi: number, iteration: number, sprintsBack: number = 2): Array<{ pi: number; iteration: number }> {
    const priorSprints: Array<{ pi: number; iteration: number }> = [];
    let currentPi = pi;
    let currentIteration = iteration;

    for (let i = 0; i < sprintsBack; i++) {
      currentIteration -= 1;

      // If we go below .1, wrap to previous PI's last iteration
      if (currentIteration < 1) {
        currentPi -= 1;
        currentIteration = 7; // Assume max 7 iterations per PI
      }

      priorSprints.push({ pi: currentPi, iteration: currentIteration });
    }

    // Reverse to get chronological order (earliest first)
    priorSprints.reverse();

    return priorSprints;
  }

  async getProjectIterations(organization: string, project: string): Promise<any[]> {
    // Fetch iterations from project classification nodes instead of team settings
    const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/classificationnodes/iterations?$depth=10&api-version=7.0`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: this.authHeader },
      });

      const iterations: any[] = [];
      
      // Recursively extract all iterations from the tree
      const extractIterations = (node: any, parentPath: string = '') => {
        const nodePath = parentPath ? `${parentPath}\\${node.name}` : node.name;
        
        if (node.structureType === 'iteration' && node.attributes) {
          iterations.push({
            id: node.id,
            name: node.name,
            path: nodePath,
            startDate: node.attributes?.startDate,
            finishDate: node.attributes?.finishDate,
          });
        }
        
        if (node.children && node.children.length > 0) {
          node.children.forEach((child: any) => extractIterations(child, nodePath));
        }
      };

      extractIterations(response.data);
      
      return iterations;
    } catch (error: any) {
      logWarn(`Error fetching project iterations: ${error.message}`);
      return [];
    }
  }

  async listAllTeams(organization: string, project: string): Promise<any[]> {
    const url = `https://dev.azure.com/${organization}/_apis/projects/${project}/teams?api-version=7.0`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: this.authHeader },
      });

      const teams = response.data.value || [];
      return teams;
    } catch (error: any) {
      logWarn(`Error listing teams: ${error.message}`);
      return [];
    }
  }

  async getTeamIterations(
    organization: string,
    project: string,
    team: { id?: string; name: string } | string
  ): Promise<any[]> {
    const teamIdOrName = typeof team === 'string' ? team : team.id || team.name;
    const displayName = typeof team === 'string' ? team : team.name;
    const encodedTeam = encodeURIComponent(teamIdOrName);
    const url = `https://dev.azure.com/${organization}/${project}/${encodedTeam}/_apis/work/teamsettings/iterations?api-version=7.0`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: this.authHeader },
      });

      const iterations = (response.data.value || []).map((iteration: any) => ({
        id: iteration.id,
        name: iteration.name,
        path: iteration.path,
        startDate: iteration.attributes?.startDate,
        finishDate: iteration.attributes?.finishDate,
      }));

      return iterations;
    } catch (error: any) {
      logWarn(`Error fetching team iterations for "${displayName}": ${error.message}`);
      return [];
    }
  }

  async findSprintDates(
    organization: string,
    project: string,
    targetSprints: Array<{ pi: number; iteration: number }>,
    iterationPath?: string
  ): Promise<{ sprintStart: string; sprintEnd: string } | null> {
    // First, list all available teams
    const allTeams = await this.listAllTeams(organization, project);
    
    // Try to extract team name from iteration path
    // Example: "Digital\Digital X\PI 39\39.7" -> extract "Digital X"
    const teamsToTry: Array<{ id?: string; name: string }> = [];
    const teamsByName = new Map<string, { id?: string; name: string }>();

    if (allTeams.length > 0) {
      allTeams.forEach((team: any) => {
        if (team.name) {
          teamsByName.set(team.name, { id: team.id, name: team.name });
        }
      });
    }

    const addTeam = (team: { id?: string; name: string } | undefined) => {
      if (!team) return;
      if (!teamsToTry.some((existing) => existing.name === team.name)) {
        teamsToTry.push(team);
      }
    };

    // Prioritize the project team first (most common case)
    addTeam(teamsByName.get(project));
    
    if (iterationPath) {
      const parts = iterationPath.split('\\');
      // Try parts between project and PI
      if (parts.length >= 3) {
        // Add the second part (often the team name)
        if (parts[1] && parts[1] !== project) {
          addTeam(teamsByName.get(parts[1]));
        }
      }
    }
    
    // Add all discovered teams from API
    if (allTeams.length > 0) {
      allTeams.forEach((team: any) => {
        if (team.name) {
          addTeam({ id: team.id, name: team.name });
        }
      });
    }

    let allIterations: any[] = [];
    let successfulTeam = '';
    for (const team of teamsToTry) {
      const iterations = await this.getTeamIterations(organization, project, team);
      if (iterations.length > 0) {
        allIterations = iterations;
        successfulTeam = team.name;
        break;
      }
    }

    if (allIterations.length === 0) {
      // Fallback: try to get iterations from project classification nodes
      allIterations = await this.getProjectIterations(organization, project);
      successfulTeam = 'Project Structure';
    }
    
    if (allIterations.length === 0) {
      logWarn('Could not fetch any iterations from ADO');
      return null;
    }

    // Match target sprints with fetched iterations
    const matchedIterations: any[] = [];
    for (const target of targetSprints) {
      const targetName = `${target.pi}.${target.iteration}`;

      for (const iteration of allIterations) {
        const iterName = iteration.name || '';
        const iterPath = iteration.path || '';
        // Try multiple matching patterns
        if (
          iterName.includes(targetName) || 
          iterName.endsWith(targetName) ||
          iterPath.includes(targetName) ||
          iterPath.endsWith(targetName)
        ) {
          matchedIterations.push(iteration);
          break;
        }
      }
    }

    if (matchedIterations.length === 0 && successfulTeam !== 'Project Structure') {
      // Fallback: try to get iterations from project classification nodes
      allIterations = await this.getProjectIterations(organization, project);
      successfulTeam = 'Project Structure';
      
      if (allIterations.length > 0) {
        // Try matching again with project iterations
        for (const target of targetSprints) {
          const targetName = `${target.pi}.${target.iteration}`;

          for (const iteration of allIterations) {
            const iterName = iteration.name || '';
            const iterPath = iteration.path || '';
            if (
              iterName.includes(targetName) || 
              iterName.endsWith(targetName) ||
              iterPath.includes(targetName) ||
              iterPath.endsWith(targetName)
            ) {
              matchedIterations.push(iteration);
              break;
            }
          }
        }
      }
    }
    
    if (matchedIterations.length === 0) {
      return null;
    }

    // Find earliest start date and latest finish date
    const startDates = matchedIterations
      .filter((it) => it.startDate)
      .map((it) => new Date(it.startDate));
    const finishDates = matchedIterations
      .filter((it) => it.finishDate)
      .map((it) => new Date(it.finishDate));

    if (startDates.length === 0 || finishDates.length === 0) {
      logWarn('Could not parse dates from matched iterations');
      return null;
    }

    const combinedStart = new Date(Math.min(...startDates.map((d) => d.getTime())));
    const combinedEnd = new Date(Math.max(...finishDates.map((d) => d.getTime())));

    const sprintStart = combinedStart.toISOString().split('T')[0];
    const sprintEnd = combinedEnd.toISOString().split('T')[0];

    return { sprintStart, sprintEnd };
  }

  async detectSprintDatesFromBugs(
    organization: string,
    project: string,
    workItems: WorkItem[]
  ): Promise<{ sprintStart: string; sprintEnd: string } | null> {
    // Extract all iteration paths
    const iterationPaths = workItems
      .map((item) => item.fields['System.IterationPath'])
      .filter((path): path is string => typeof path === 'string' && path.length > 0);

    if (iterationPaths.length === 0) {
      logWarn('No iteration paths found in work items');
      return null;
    }

    // Find the most common iteration path (majority sprint)
    const pathCounts: { [key: string]: number } = {};
    iterationPaths.forEach((path) => {
      pathCounts[path] = (pathCounts[path] || 0) + 1;
    });

    const majorityPath = Object.keys(pathCounts).reduce((a, b) =>
      pathCounts[a] > pathCounts[b] ? a : b
    );
    const count = pathCounts[majorityPath];

    logDebug(`Detected majority iteration path: ${majorityPath} (${count}/${iterationPaths.length} bugs)`);

    // Parse PI and iteration from majority path
    const iterInfo = this.extractIterationInfo(majorityPath);
    if (!iterInfo) {
      logWarn(`Could not parse iteration info from path: ${majorityPath}`);
      return null;
    }

    // Calculate 2 sprints back
    const priorSprints = this.calculatePriorSprints(iterInfo.pi, iterInfo.iteration, 2);

    logDebug(
      `Detected sprint ${iterInfo.pi}.${iterInfo.iteration}, analyzing prior sprints: ` +
        `${priorSprints[0].pi}.${priorSprints[0].iteration} and ` +
        `${priorSprints[1].pi}.${priorSprints[1].iteration}`
    );

    // Fetch dates for prior sprints, pass the iteration path to help identify the team
    const sprintDates = await this.findSprintDates(organization, project, priorSprints, majorityPath);

    return sprintDates;
  }
}
