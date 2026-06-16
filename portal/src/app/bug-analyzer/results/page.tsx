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
  Loader2
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import * as XLSX from 'xlsx';

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<BugAnalysisResult[]>([]);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [expandedBug, setExpandedBug] = useState<number | null>(null);
  const [filterClassification, setFilterClassification] = useState<string>('ALL');
  const [rcaReports, setRcaReports] = useState<Record<number, RCAReport>>({});
  const [generatingRCA, setGeneratingRCA] = useState<number | null>(null);

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

    // Calculate summary
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

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      results.map((r) => ({
        ID: r.id,
        Title: r.title,
        Classification: r.classification,
        Confidence: r.confidence,
        'Issue Type': r.issue_type?.type || 'N/A',
        'Type Confidence': r.issue_type?.confidence || 'N/A',
        'Type Indicators': r.issue_type?.indicators.join(', ') || 'N/A',
        'Introduced By': r.bug_origin?.introduced_by || 'N/A',
        'Introduced In Commit': r.bug_origin?.introduced_in_commit || 'N/A',
        'Introduced Date': r.bug_origin?.introduced_date || 'N/A',
        'Fixed By': r.bug_origin?.fixed_by || 'N/A',
        'Files Affected': r.bug_origin?.files_affected.join(', ') || 'N/A',
        State: r.state,
        Priority: r.priority,
        Severity: r.severity,
        'Assigned To': r.assigned_to,
        'Created Date': r.created_date,
        'PR Count': r.pr_count,
        'PR Titles': r.pr_titles,
        Reasoning: r.reasoning,
        'Area Path': r.area_path,
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bug Analysis');

    // Add summary sheet
    if (summary) {
      const summaryData = [
        ['Bug Analysis Summary', ''],
        ['', ''],
        ['Total Bugs Analyzed', summary.total],
        ['Progressions', summary.progressions],
        ['Regressions', summary.regressions],
        ['Unclear', summary.unclear],
        ['', ''],
        ['Progression Rate', `${summary.progressionRate.toFixed(1)}%`],
        ['Regression Rate', `${summary.regressionRate.toFixed(1)}%`],
      ];

      const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
    }

    XLSX.writeFile(workbook, 'bug_analysis_report.xlsx');
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'PROGRESSION':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'REGRESSION':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'UNCLEAR':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
    rca.initialAnalysis.nextSteps.forEach((step, idx) => {
      markdown += `${idx + 1}. ${step}\n`;
    });
    markdown += `\n---\n\n`;

    markdown += `## RCA (After Fix is Finalized)\n\n`;
    markdown += `### Issue Type\n✓ ${rca.finalization.issueType}\n\n`;
    markdown += `### Scope of Issue\n${rca.finalization.scopeOfIssue}\n\n`;
    markdown += `### Fix Applied\n${rca.finalization.fixApplied}\n\n`;
    markdown += `### Changed Area\n`;
    rca.finalization.changedArea.forEach(area => {
      markdown += `- ${area}\n`;
    });
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
    {
      name: 'High',
      count: results.filter((r) => r.confidence === 'HIGH').length,
    },
    {
      name: 'Medium',
      count: results.filter((r) => r.confidence === 'MEDIUM').length,
    },
    {
      name: 'Low',
      count: results.filter((r) => r.confidence === 'LOW').length,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a]">
      <AppHeader
        title="VOIS - Bug Analyzer"
        subtitle={`${summary.total} bugs analyzed`}
        actions={
          <>
            <button
              onClick={handleNewAnalysis}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition"
            >
              <Home className="w-4 h-4" />
              New analysis
            </button>
            <button
              onClick={exportToExcel}
              className="inline-flex items-center gap-2 rounded-full bg-white text-[#e60000] px-4 py-2 text-sm font-semibold hover:bg-white/90 transition"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </>
        }
      />

      <main className="container mx-auto px-4 py-8">
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
                  {filter === 'ALL'
                    ? 'All'
                    : filter === 'PROGRESSION'
                    ? 'Progression'
                    : filter === 'REGRESSION'
                    ? 'Regression'
                    : 'Unclear'}
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
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-mono text-gray-500">#{bug.id}</span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getClassificationColor(
                          bug.classification
                        )}`}
                      >
                        {bug.classification.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getConfidenceBadge(bug.confidence)}`}>
                        {bug.confidence}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{bug.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
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
                    </div>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-full transition">
                    {expandedBug === bug.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {expandedBug === bug.id && (
                <div className="px-6 pb-6 border-t border-gray-200">
                  <div className="mt-4 space-y-4">
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

                    {bug.pr_titles && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Linked Pull Requests</h4>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-sm text-gray-700">{bug.pr_titles}</p>
                        </div>
                      </div>
                    )}

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
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <FileText className="w-4 h-4" />
                                Generate RCA
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {!rcaReports[bug.id] && (
                        <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-xl p-3">
                          <p className="text-sm text-[#9a3412]">
                            GitHub Copilot AI will generate this RCA. Make sure your GitHub PAT is configured in Settings, or set the <code className="font-mono bg-[#ffedd5] px-1 rounded">GITHUB_TOKEN</code> environment variable on the server.
                          </p>
                        </div>
                      )}

                      {rcaReports[bug.id] && (
                        <div className="space-y-4">
                          {/* Initial Analysis */}
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <h5 className="font-semibold text-blue-900 mb-3">
                              Initial Analysis (Before Investigation)
                            </h5>
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

                          {/* RCA Finalization */}
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <h5 className="font-semibold text-gray-900 mb-3">
                              RCA (After Fix is Finalized)
                            </h5>
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

                          {/* Download Button */}
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
