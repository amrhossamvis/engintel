import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const getDefaultRepoRoots = () => {
  const home = os.homedir();
  return [
    path.join(home, 'Desktop', 'Azure', 'MVA-iOS'),
    path.join(home, 'Desktop', 'Azure', 'MVA-Android'),
  ];
};

const getRepoRoots = () => {
  const envRoots = process.env.REPO_ROOTS;
  if (envRoots) {
    return envRoots
      .split(',')
      .map((root) => root.trim())
      .filter((root) => root.length > 0);
  }
  return getDefaultRepoRoots();
};

const pathExists = async (candidate: string) => {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
};

const isGitRepo = async (candidate: string) => {
  return pathExists(path.join(candidate, '.git'));
};

export const resolveRepoPath = async (repoName: string) => {
  const roots = getRepoRoots();
  const targetName = repoName.toLowerCase();
  for (const root of roots) {
    const rootBase = path.basename(root).toLowerCase();
    if (rootBase === targetName && (await isGitRepo(root))) {
      return root;
    }

    const direct = path.join(root, repoName);
    if (await isGitRepo(direct)) {
      return direct;
    }

    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const candidate = path.join(root, entry.name, repoName);
        if (await isGitRepo(candidate)) {
          return candidate;
        }
      }
    } catch {
      // Ignore missing roots.
    }
  }
  return null;
};

const sanitizePath = (filePath: string) => {
  return filePath.replace(/^\\+|^\/+/, '').trim();
};

const runGitLog = async (
  repoPath: string,
  filePath: string,
  sinceIso: string,
  beforeIso?: string
) => {
  const args = ['log', `--since=${sinceIso}`];
  if (beforeIso) {
    args.push(`--before=${beforeIso}`);
  }
  args.push('--pretty=%ct', '--max-count=50', '--', filePath);
  const result = await execFileAsync('git', args, { cwd: repoPath });
  const output = result.stdout.toString().trim();
  if (!output) return [];
  return output
    .split('\n')
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((timestamp) => Number.isFinite(timestamp));
};

export type GitSignals = {
  repoName: string;
  totalFiles: number;
  inputFiles: number;
  recentFiles: number;
  recentCommits: number;
  newFiles: number;
  latestChange?: string;
  notes?: string;
};

export const getGitSignalsForFiles = async (
  repoName: string,
  filePaths: string[],
  sprintStart: Date,
  lookbackDays: number,
  beforeDate?: Date
): Promise<GitSignals> => {
  const repoPath = await resolveRepoPath(repoName);
  const uniqueFiles = Array.from(new Set(filePaths.map(sanitizePath))).filter((file) => file.length > 0);
  const limitedFiles = uniqueFiles.slice(0, 20);

  if (!repoPath) {
    return {
      repoName,
      totalFiles: limitedFiles.length,
      inputFiles: uniqueFiles.length,
      recentFiles: 0,
      recentCommits: 0,
      newFiles: 0,
      notes: 'Repository not found locally',
    };
  }

  const recentThreshold = new Date(sprintStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lookbackThreshold = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const sinceDate = new Date(Math.max(recentThreshold.getTime(), lookbackThreshold.getTime()));
  const sinceIso = sinceDate.toISOString();
  const beforeIso = beforeDate ? beforeDate.toISOString() : undefined;

  let recentFiles = 0;
  let recentCommits = 0;
  let newFiles = 0;
  let latestCommitTs = 0;

  for (const filePath of limitedFiles) {
    const absolutePath = path.join(repoPath, filePath);
    if (!(await pathExists(absolutePath))) {
      continue;
    }

    const commits = await runGitLog(repoPath, filePath, sinceIso, beforeIso);
    if (commits.length === 0) {
      continue;
    }

    const fileLatest = Math.max(...commits);
    if (fileLatest > latestCommitTs) {
      latestCommitTs = fileLatest;
    }

    const recentForFile = commits.filter((ts) => ts * 1000 >= recentThreshold.getTime());
    if (recentForFile.length > 0) {
      recentFiles += 1;
      recentCommits += recentForFile.length;
      
      // Check if ALL commits for this file are in the recent window
      // This indicates the file was newly created
      if (commits.length === recentForFile.length) {
        newFiles += 1;
      }
    }
  }

  return {
    repoName,
    totalFiles: limitedFiles.length,
    inputFiles: uniqueFiles.length,
    recentFiles,
    recentCommits,
    newFiles,
    latestChange: latestCommitTs ? new Date(latestCommitTs * 1000).toISOString() : undefined,
  };
};
