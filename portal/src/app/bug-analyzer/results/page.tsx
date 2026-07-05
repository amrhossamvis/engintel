'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BugAnalysisResult, AnalysisSummary, RCAReport } from '@/types';
import { logError } from '@/lib/logger';
import { AppHeader } from '@/components/AppHeader';
import {
  Bug,
  Home,
  Download,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  GitPullRequest,
  Info,
  FileText,
  AlertCircle,
  Loader2,
  RefreshCw,
  Cpu,
  GitBranch,
  Archive,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import ExcelJS from 'exceljs';

// ── Analysis method badge ────────────────────────────────────────────────────
function AnalysisMethodBadge({ method, fromCache }: { method?: string; fromCache?: boolean }) {
  if (!method) return null;

  const config = {
    copilot: {
      label: 'Copilot AI',
      icon: <Cpu className="w-3 h-3" />,
      className: 'bg-purple-100 text-purple-800 border border-purple-200',
    },
    'rule-based': {
      label: 'Rule-based',
      icon: <GitBranch className="w-3 h-3" />,
      className: 'bg-blue-100 text-blue-800 border border-blue-200',
    },
  }[method] ?? {
    label: method,
    icon: null,
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
        title={`Analysed using: ${config.label}`}
      >
        {config.icon}
        {config.label}
      </span>
      {fromCache && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200"
          title="Loaded from persistent cache"
        >
          <Archive className="w-3 h-3" />
          Cached
        </span>
      )}
    </span>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<BugAnalysisResult[]>([]);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [expandedBug, setExpandedBug] = useState<number | null>(null);
  const [filterClassification, setFilterClassification] = useState<string>('ALL');
  const [rcaReports, setRcaReports] = useState<Record<number, RCAReport>>({});
  const [generatingRCA, setGeneratingRCA] = useState<number | null>(null);
  const [reanalyzingBug, setReanalyzingBug] = useState<number | null>(null);

  // Stored query context needed for re-analysis
  const [queryUrl, setQueryUrl] = useState('');
  const [sprintStart, setSprintStart] = useState('');
  const [sprintEnd, setSprintEnd] = useState('');

  const handleBack = () => {
    router.push('/bug-analyzer');
  };

  const handleNewAnalysis = () => {
    sessionStorage.removeItem('analysisResults');
    router.push('/bug-analyzer');
  };

  useEffect(() => {
    const storedResults = sessionStorage.getItem('analysisResults');
    if (!storedResults) {
      router.push('/bug-analyzer');
      return;
    }

    const parsedResults: BugAnalysisResult[] = JSON.parse(storedResults);
    setResults(parsedResults);

    // Restore query context for re-analysis
    setQueryUrl(sessionStorage.getItem('analysisQueryUrl') || '');
    setSprintStart(sessionStorage.getItem('analysisSprintStart') || '');
    setSprintEnd(sessionStorage.getItem('analysisSprintEnd') || '');

    const total = parsedResults.length;
    const progressions = parsedResults.filter((r) => r.classification === 'PROGRESSION').length;
    const regressions = parsedResults.filter((r) => r.classification === 'REGRESSION').length;
    const unclear = parsedResults.filter((r) => r.classification === 'UNCLEAR').length;

    setSummary({
      total,
      progressions,
      regressions,
      unclear,
      progressionRate: total > 0 ? (progressions / total) * 100 : 0,
      regressionRate: total > 0 ? (regressions / total) * 100 : 0,
    });
  }, [router]);

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Engineering Intelligence Hub';
    workbook.created = new Date();

    // ── Bug Analysis sheet ────────────────────────────────────────────────
    const sheet = workbook.addWorksheet('Bug Analysis');
    sheet.columns = [
      { header: 'ID',                   key: 'id',               width: 10 },
      { header: 'Title',                key: 'title',            width: 50 },
      { header: 'Classification',       key: 'classification',   width: 16 },
      { header: 'Confidence',           key: 'confidence',       width: 12 },
      { header: 'Analysis Method',      key: 'method',           width: 16 },
      { header: 'Analysed At',          key: 'analyzedAt',       width: 22 },
      { header: 'Issue Type',           key: 'issueType',        width: 18 },
      { header: 'Type Confidence',      key: 'typeConf',         width: 16 },
      { header: 'Type Indicators',      key: 'typeInd',          width: 40 },
      { header: 'Introduced By',        key: 'introBy',          width: 22 },
      { header: 'Introduced In Commit', key: 'introCommit',      width: 30 },
      { header: 'Introduced Date',      key: 'introDate',        width: 18 },
      { header: 'Fixed By',             key: 'fixedBy',          width: 22 },
      { header: 'Files Affected',       key: 'files',            width: 50 },
      { header: 'State',                key: 'state',            width: 14 },
      { header: 'Priority',             key: 'priority',         width: 12 },
      { header: 'Severity',             key: 'severity',         width: 12 },
      { header: 'Assigned To',          key: 'assignedTo',       width: 24 },
      { header: 'Created Date',         key: 'createdDate',      width: 18 },
      { header: 'PR Count',             key: 'prCount',          width: 10 },
      { header: 'PR Titles',            key: 'prTitles',         width: 50 },
      { header: 'Reasoning',            key: 'reasoning',        width: 60 },
      { header: 'Area Path',            key: 'areaPath',         width: 40 },
    ];

    // Header styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE60000' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    results.forEach((r, i) => {
      const row = sheet.addRow({
        id:           r.id,
        title:        r.title,
        classification: r.classification,
        confidence:   r.confidence,
        method:       r.analysisMethod || 'N/A',
        analyzedAt:   r.analyzedAt ? new Date(r.analyzedAt).toLocaleString() : 'N/A',
        issueType:    r.issue_type?.type || 'N/A',
        typeConf:     r.issue_type?.confidence || 'N/A',
        typeInd:      r.issue_type?.indicators.join(', ') || 'N/A',
        introBy:      r.bug_origin?.introduced_by || 'N/A',
        introCommit:  r.bug_origin?.introduced_in_commit || 'N/A',
        introDate:    r.bug_origin?.introduced_date || 'N/A',
        fixedBy:      r.bug_origin?.fixed_by || 'N/A',
        files:        r.bug_origin?.files_affected.join(', ') || 'N/A',
        state:        r.state,
        priority:     r.priority,
        severity:     r.severity,
        assignedTo:   r.assigned_to,
        createdDate:  r.created_date,
        prCount:      r.pr_count,
        prTitles:     r.pr_titles,
        reasoning:    r.reasoning,
        areaPath:     r.area_path,
      });
      row.eachCell((cell) => { cell.alignment = { wrapText: true, vertical: 'top' }; });
      if (i % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
        });
      }
    });

    // ── Summary sheet ─────────────────────────────────────────────────────
    if (summary) {
      const sumSheet = workbook.addWorksheet('Summary');
      sumSheet.columns = [{ header: 'Metric', key: 'metric', width: 28 }, { header: 'Value', key: 'value', width: 16 }];
      const sumHeader = sumSheet.getRow(1);
      sumHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sumHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE60000' } };
      [
        { metric: 'Total Bugs Analyzed',  value: summary.total },
        { metric: 'Progressions',         value: summary.progressions },
        { metric: 'Regressions',          value: summary.regressions },
        { metric: 'Unclear',              value: summary.unclear },
        { metric: 'Progression Rate',     value: `${summary.progressionRate.toFixed(1)}%` },
        { metric: 'Regression Rate',      value: `${summary.regressionRate.toFixed(1)}%` },
      ].forEach(row => sumSheet.addRow(row));
    }

    // ── Trigger download ──────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bug_analysis_report.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'PROGRESSION': return 'bg-red-100 text-red-800 border-red-200';
      case 'REGRESSION': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'UNCLEAR': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      HIGH: 'bg-green-100 text-green-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      LOW: 'bg-orange-100 text-orange-800',
    };
    return colors[confidence as keyof typeof colors] || colors.LOW;
  };

  const getGithubPat = () =>
    typeof window !== 'undefined' ? localStorage.getItem('github_pat_token') || '' : '';

  const getAdoPat = () =>
    typeof window !== 'undefined' ? localStorage.getItem('ado_pat_token') || '' : '';

  const generateRCAReport = async (bug: BugAnalysisResult) => {
    setGeneratingRCA(bug.id);
    try {
      const githubPat = getGithubPat();
      const response = await fetch('/api/rca', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(githubPat ? { 'x-github-pat': githubPat } : {}),
        },
        body: JSON.stringify({ bugData: bug }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate RCA');
      }

      const data = await response.json();
      setRcaReports((prev) => ({ ...prev, [bug.id]: data.rca }));
    } catch (error: any) {
      logError('Error generating RCA:', error);
      alert(`Failed to generate RCA: ${error.message}`);
    } finally {
      setGeneratingRCA(null);
    }
  };

  // ── Re-analyze a single bug ──────────────────────────────────────────────
  const reanalyzeBug = async (bug: BugAnalysisResult) => {
    const patToken = getAdoPat();
    if (!patToken || !queryUrl) {
      alert('PAT token or query URL not available. Please run a new analysis from the main page.');
      return;
    }

    setReanalyzingBug(bug.id);
    try {
      const githubPat = getGithubPat();
      const response = await fetch('/api/analyze/reanalyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(githubPat ? { 'x-github-pat': githubPat } : {}),
        },
        body: JSON.stringify({
          queryUrl,
          patToken,
          bugId: bug.id,
          sprintStart,
          sprintEnd,
          useCopilot: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Re-analysis failed');
      }

      const data = await response.json();
      const updated: BugAnalysisResult = data.result;

      // Update local state
      setResults((prev) => {
        const next = prev.map((r) => (r.id === updated.id ? updated : r));
        sessionStorage.setItem('analysisResults', JSON.stringify(next));
        return next;
      });

      // Recalculate summary
      setResults((prev) => {
        const total = prev.length;
        const progressions = prev.filter((r) => r.classification === 'PROGRESSION').length;
        const regressions = prev.filter((r) => r.classification === 'REGRESSION').length;
        const unclear = prev.filter((r) => r.classification === 'UNCLEAR').length;
        setSummary({
          total,
          progressions,
          regressions,
          unclear,
          progressionRate: total > 0 ? (progressions / total) * 100 : 0,
          regressionRate: total > 0 ? (regressions / total) * 100 : 0,
        });
        return prev;
      });
    } catch (error: any) {
      logError('Error re-analyzing bug:', error);
      alert(`Re-analysis failed: ${error.message}`);
    } finally {
      setReanalyzingBug(null);
    }
  };

  const downloadRCAMarkdown = (bugId: number) => {
    const rca = rcaReports[bugId];
    if (!rca) return;

    let markdown = `# Root Cause Analysis (RCA) Report\n\n`;
    markdown += `**Bug ID:** ${rca.bugId}\n`;
    markdown += `**Bug Title:** ${rca.bugTitle}\n`;
    markdown += `**Generated:** ${new Date(rca.generatedAt).toLocaleString()}\n\n`;
    markdown += `---\n\n`;
    markdown += `## Initial Analysis (Before Investigation)\n\n`;
    markdown += `### Observation\n${rca.initialAnalysis.observation}\n\n`;
    markdown += `### Suspected Cause\n${rca.initialAnalysis.suspectedCause}\n\n`;
    markdown += `### Next Steps\n`;
    rca.initialAnalysis.nextSteps.forEach((step, idx) => { markdown += `${idx + 1}. ${step}\n`; });
    markdown += `\n---\n\n`;
    markdown += `## RCA (After Fix is Finalized)\n\n`;
    markdown += `### Issue Type\n✓ ${rca.finalization.issueType}\n\n`;
    markdown += `### Scope of Issue\n${rca.finalization.scopeOfIssue}\n\n`;
    markdown += `### Fix Applied\n${rca.finalization.fixApplied}\n\n`;
    markdown += `### Changed Area\n`;
    rca.finalization.changedArea.forEach((area) => { markdown += `- ${area}\n`; });
    markdown += `\n`;
    markdown += `### Impact on Other Components\n`;
    markdown += `${rca.finalization.impactOnOtherComponents ? '✓ Yes' : '✗ No'}\n\n`;
    if (rca.finalization.impactDetails) {
      markdown += `**Impact Details:** ${rca.finalization.impactDetails}\n\n`;
    }
    markdown += `### Related Work Item\n**Work Item ID:** ${rca.finalization.relatedWorkItemId}\n\n`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RCA_Bug_${bugId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredResults = results.filter(
    (r) => filterClassification === 'ALL' || r.classification === filterClassification
  );

  if (!summary) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e60000] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  const pieData = [
    { name: 'Progressions', value: summary.progressions, color: '#e60000' },
    { name: 'Regressions', value: summary.regressions, color: '#F59E0B' },
    { name: 'Unclear', value: summary.unclear, color: '#9CA3AF' },
  ].filter((entry) => entry.value > 0);

  const confidenceData = [
    { name: 'High', count: results.filter((r) => r.confidence === 'HIGH').length },
    { name: 'Medium', count: results.filter((r) => r.confidence === 'MEDIUM').length },
    { name: 'Low', count: results.filter((r) => r.confidence === 'LOW').length },
  ];

  // Method breakdown for info bar
  const cachedCount = results.filter((r) => r.fromCache).length;
  const copilotCount = results.filter((r) => r.analysisMethod === 'copilot').length;
  const ruleCount = results.filter((r) => r.analysisMethod === 'rule-based').length;

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a]">
      <AppHeader
        title="VOIS - Bug Analyzer"
        subtitle={`${summary.total} bugs analyzed`}
        actions={
          <>
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleNewAnalysis}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition"
            >
              <Home className="w-4 h-4" />
              New analysis
            </button>
            <button
              onClick={() => void exportToExcel()}
              className="inline-flex items-center gap-2 rounded-full bg-white text-[#e60000] px-4 py-2 text-sm font-semibold hover:bg-white/90 transition"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </>
        }
      />

      <main className="container mx-auto px-4 py-8">

        {/* Analysis method info bar */}
        {(cachedCount > 0 || copilotCount > 0 || ruleCount > 0) && (
          <div className="flex flex-wrap items-center gap-3 mb-6 px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm text-sm text-gray-600">
            <span className="font-medium text-gray-700">Analysis breakdown:</span>
            {cachedCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-semibold text-gray-800">{cachedCount}</span> from cache
              </span>
            )}
            {copilotCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-500" />
                <span className="font-semibold text-gray-800">{copilotCount}</span> via Copilot AI
              </span>
            )}
            {ruleCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-semibold text-gray-800">{ruleCount}</span> rule-based
              </span>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Bugs</h3>
              <Bug className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{summary.total}</p>
          </div>

          <div className="bg-[#fff1f2] rounded-2xl shadow-sm border border-[#fecdd3] p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-red-700">Progressions</h3>
              <TrendingUp className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-900">{summary.progressions}</p>
            <p className="text-sm text-red-600 mt-1">{summary.progressionRate.toFixed(1)}%</p>
          </div>

          <div className="bg-[#fff7ed] rounded-2xl shadow-sm border border-[#fed7aa] p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-yellow-700">Regressions</h3>
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-yellow-900">{summary.regressions}</p>
            <p className="text-sm text-yellow-600 mt-1">{summary.regressionRate.toFixed(1)}%</p>
          </div>

          <div className="bg-[#f3f4f6] rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Unclear</h3>
              <HelpCircle className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{summary.unclear}</p>
            <p className="text-sm text-gray-600 mt-1">
              {((summary.unclear / summary.total) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Classification Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent, value }) =>
                    value === 0 ? '' : `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confidence Levels</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={confidenceData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#e60000" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Filter by:</span>
            <div className="flex gap-2">
              {['ALL', 'PROGRESSION', 'REGRESSION', 'UNCLEAR'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setFilterClassification(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    filterClassification === filter
                      ? 'bg-[#e60000] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter === 'ALL' ? 'All' : filter === 'PROGRESSION' ? 'Progression' : filter === 'REGRESSION' ? 'Regression' : 'Unclear'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bug List */}
        <div className="space-y-4">
          {filteredResults.map((bug) => (
            <div
              key={bug.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition"
            >
              <div
                className="p-6 cursor-pointer"
                onClick={() => setExpandedBug(expandedBug === bug.id ? null : bug.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm font-mono text-gray-500">#{bug.id}</span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getClassificationColor(bug.classification)}`}
                      >
                        {bug.classification.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getConfidenceBadge(bug.confidence)}`}>
                        {bug.confidence}
                      </span>
                      {/* Analysis method badge */}
                      <AnalysisMethodBadge method={bug.analysisMethod} fromCache={bug.fromCache} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{bug.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {bug.assigned_to}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitPullRequest className="w-4 h-4" />
                        {bug.pr_count} PR{bug.pr_count !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(bug.created_date).toLocaleDateString()}
                      </span>
                      {bug.analyzedAt && (
                        <span className="flex items-center gap-1 text-gray-400 text-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          Analysed {new Date(bug.analyzedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {/* Re-analyze button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); reanalyzeBug(bug); }}
                      disabled={reanalyzingBug === bug.id}
                      title="Re-analyze this bug"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-[#e60000] hover:text-[#e60000] disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {reanalyzingBug === bug.id ? (
                        <><Loader2 className="w-3 h-3 animate-spin" />Re-analyzing…</>
                      ) : (
                        <><RefreshCw className="w-3 h-3" />Re-analyze</>
                      )}
                    </button>

                    <button className="p-2 hover:bg-gray-100 rounded-full transition">
                      {expandedBug === bug.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {expandedBug === bug.id && (
                <div className="px-6 pb-6 border-t border-gray-200">
                  <div className="mt-4 space-y-4">

                    {/* Analysis method detail */}
                    {bug.analysisMethod && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <AnalysisMethodBadge method={bug.analysisMethod} />
                        {bug.analyzedAt && (
                          <span>· Last analysed {new Date(bug.analyzedAt).toLocaleString()}</span>
                        )}
                      </div>
                    )}

                    <div className="bg-[#fff1f2] rounded-xl p-4 border border-[#fecdd3]">
                      <div className="flex items-start gap-2">
                        <Info className="w-5 h-5 text-[#e60000] mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-[#7f1d1d] mb-1">Analysis Reasoning</h4>
                          <p className="text-sm text-[#7f1d1d] whitespace-pre-wrap leading-relaxed">{bug.reasoning}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Priority</p>
                        <p className="font-medium text-gray-900">{bug.priority}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Severity</p>
                        <p className="font-medium text-gray-900">{bug.severity}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">State</p>
                        <p className="font-medium text-gray-900">{bug.state}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Area Path</p>
                        <p className="font-medium text-gray-900 text-sm">{bug.area_path}</p>
                      </div>
                    </div>

                    {bug.issue_type && (
                      <div className="bg-[#fff7ed] rounded-xl p-4 border border-[#fed7aa]">
                        <div className="flex items-start gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-[#b45309] mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold text-[#7c2d12]">Issue Type Detection</h4>
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-[#7c2d12]">
                                <span className="font-medium">Type:</span>{' '}
                                <span className="capitalize">{bug.issue_type.type.replace('_', ' ')}</span>
                              </p>
                              <p className="text-sm text-[#7c2d12]">
                                <span className="font-medium">Confidence:</span>{' '}
                                <span className="capitalize">{bug.issue_type.confidence}</span>
                              </p>
                              {bug.issue_type.indicators.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-sm font-medium text-[#7c2d12] mb-1">Indicators:</p>
                                  <ul className="list-disc list-inside text-sm text-[#7c2d12] space-y-0.5">
                                    {bug.issue_type.indicators.map((indicator, idx) => (
                                      <li key={idx}>{indicator}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {bug.bug_origin && (
                      <div className="bg-[#fff7ed] rounded-xl p-4 border border-[#fed7aa]">
                        <div className="flex items-start gap-2">
                          <User className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-amber-900 mb-2">Bug Origin Trace</h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-[#9a3412] font-medium">Introduced By:</p>
                                <p className="text-[#7c2d12]">{bug.bug_origin.introduced_by}</p>
                              </div>
                              <div>
                                <p className="text-[#9a3412] font-medium">Fixed By:</p>
                                <p className="text-[#7c2d12]">{bug.bug_origin.fixed_by}</p>
                              </div>
                              <div>
                                <p className="text-[#9a3412] font-medium">Introduced In:</p>
                                <p className="text-[#7c2d12] font-mono text-xs">{bug.bug_origin.introduced_in_commit}</p>
                              </div>
                              <div>
                                <p className="text-[#9a3412] font-medium">Introduced Date:</p>
                                <p className="text-[#7c2d12]">{bug.bug_origin.introduced_date}</p>
                              </div>
                            </div>
                            {bug.bug_origin.files_affected.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[#9a3412] font-medium text-sm mb-1">Files Affected:</p>
                                <div className="bg-[#ffedd5] rounded p-2 max-h-32 overflow-y-auto">
                                  <ul className="text-xs text-[#7c2d12] space-y-1 font-mono">
                                    {bug.bug_origin.files_affected.slice(0, 10).map((file, idx) => (
                                      <li key={idx}>{file}</li>
                                    ))}
                                    {bug.bug_origin.files_affected.length > 10 && (
                                      <li className="text-[#9a3412]">... and {bug.bug_origin.files_affected.length - 10} more</li>
                                    )}
                                  </ul>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                     {bug.linked_prs && bug.linked_prs.length > 0 && (() => {
                       // Parse org + project from the stored ADO query URL
                       // e.g. https://dev.azure.com/{org}/{project}/_queries/...
                       const adoMatch = queryUrl.match(/https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)/);
                       const adoOrg = adoMatch?.[1] ?? '';
                       const adoProject = adoMatch?.[2] ?? '';

                       return (
                         <div>
                           <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                             <GitPullRequest className="w-4 h-4 text-gray-500" />
                             Linked Pull Requests
                             <span className="text-xs font-normal text-gray-400">({bug.linked_prs.length})</span>
                           </h4>
                           <ul className="space-y-1.5">
                             {bug.linked_prs.map((pr, idx) => {
                               const rawTitle = pr.title || 'Untitled PR';
                               const shortTitle = rawTitle
                                  .replace(/\s*##.*$/, '')
                                  .replace(/\s*\n.*$/, '')
                                 .trim()
                                 .substring(0, 80);
                               const displayTitle = shortTitle + (rawTitle.trim().length > 80 || rawTitle.includes('##') ? '…' : '');
                               const prDate = pr.creationDate
                                 ? new Date(pr.creationDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                 : null;

                               // Build ADO PR URL for real PRs (numeric id or non-commit string)
                               const isCommit = typeof pr.id === 'string' && pr.id.startsWith('commit-');
                               const prUrl =
                                 !isCommit && adoOrg && adoProject && pr.repositoryName
                                   ? `https://dev.azure.com/${adoOrg}/${encodeURIComponent(adoProject)}/_git/${encodeURIComponent(pr.repositoryName)}/pullrequest/${pr.id}`
                                   : null;

                               const rowContent = (
                                 <>
                                   <GitPullRequest className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                                   <div className="min-w-0 flex-1">
                                     <p className="text-sm font-medium text-gray-800 truncate" title={rawTitle}>
                                       {displayTitle}
                                     </p>
                                     {prDate && (
                                       <p className="text-xs text-gray-400 mt-0.5">{prDate}</p>
                                     )}
                                   </div>
                                   {prUrl && (
                                     <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                                   )}
                                 </>
                               );

                               return prUrl ? (
                                 <li key={`${pr.id}-${idx}`}>
                                   <a
                                     href={prUrl}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 hover:bg-purple-50 hover:border-purple-200 transition"
                                   >
                                     {rowContent}
                                   </a>
                                 </li>
                               ) : (
                                 <li
                                   key={`${pr.id}-${idx}`}
                                   className="flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100"
                                 >
                                   {rowContent}
                                 </li>
                               );
                             })}
                           </ul>
                         </div>
                       );
                     })()}

                    {/* RCA Section */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-[#e60000]" />
                          Root Cause Analysis (RCA)
                        </h4>
                        {!rcaReports[bug.id] && (
                          <button
                            onClick={() => generateRCAReport(bug)}
                            disabled={generatingRCA === bug.id}
                            className="px-4 py-2 bg-[#e60000] text-white rounded-full hover:bg-[#c30000] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                          >
                            {generatingRCA === bug.id ? (
                              <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                            ) : (
                              <><FileText className="w-4 h-4" />Generate RCA</>
                            )}
                          </button>
                        )}
                      </div>

                      {!rcaReports[bug.id] && (
                        <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-xl p-3">
                          <p className="text-sm text-[#9a3412]">
                            GitHub Copilot AI will generate this RCA. Make sure your GitHub PAT is configured in Settings, or set the{' '}
                            <code className="font-mono bg-[#ffedd5] px-1 rounded">GITHUB_TOKEN</code> environment variable on the server.
                          </p>
                        </div>
                      )}

                      {rcaReports[bug.id] && (
                        <div className="space-y-4">
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <h5 className="font-semibold text-blue-900 mb-3">Initial Analysis (Before Investigation)</h5>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-1">Observation</p>
                                <p className="text-sm text-gray-900">{rcaReports[bug.id].initialAnalysis.observation}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-1">Suspected Cause</p>
                                <p className="text-sm text-gray-900">{rcaReports[bug.id].initialAnalysis.suspectedCause}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-1">Next Steps</p>
                                <ol className="list-decimal list-inside space-y-1">
                                  {rcaReports[bug.id].initialAnalysis.nextSteps.map((step, idx) => (
                                    <li key={idx} className="text-sm text-gray-900">{step}</li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <h5 className="font-semibold text-gray-900 mb-3">RCA (After Fix is Finalized)</h5>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 mb-1">Issue Type</p>
                                  <p className="text-sm text-gray-900">✓ {rcaReports[bug.id].finalization.issueType}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 mb-1">Impact</p>
                                  <p className="text-sm text-gray-900">
                                    {rcaReports[bug.id].finalization.impactOnOtherComponents ? '✓ Yes' : '✗ No'}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-1">Scope of Issue</p>
                                <p className="text-sm text-gray-900">{rcaReports[bug.id].finalization.scopeOfIssue}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-1">Fix Applied</p>
                                <p className="text-sm text-gray-900">{rcaReports[bug.id].finalization.fixApplied}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-1">Changed Area</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {rcaReports[bug.id].finalization.changedArea.map((area, idx) => (
                                    <li key={idx} className="text-sm text-gray-900">{area}</li>
                                  ))}
                                </ul>
                              </div>
                              {rcaReports[bug.id].finalization.impactDetails && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 mb-1">Impact Details</p>
                                  <p className="text-sm text-gray-900">{rcaReports[bug.id].finalization.impactDetails}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              onClick={() => downloadRCAMarkdown(bug.id)}
                              className="px-4 py-2 bg-[#e60000] text-white rounded-full hover:bg-[#c30000] transition flex items-center gap-2 text-sm"
                            >
                              <Download className="w-4 h-4" />
                              Download RCA (Markdown)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredResults.length === 0 && (
          <div className="text-center py-12">
            <Bug className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No bugs found matching the selected filter.</p>
          </div>
        )}
      </main>
    </div>
  );
}
