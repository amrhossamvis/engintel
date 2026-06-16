'use client';

import { useState } from 'react';
import { FileCode, ChevronDown, ChevronRight, FileText } from 'lucide-react';

interface StoryFileManifestProps {
  files: string[];
  totalChars?: number;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'swift') return <span className="text-orange-500 text-[10px] font-bold font-mono">SW</span>;
  if (ext === 'm') return <span className="text-blue-500 text-[10px] font-bold font-mono">OC</span>;
  if (ext === 'h') return <span className="text-purple-500 text-[10px] font-bold font-mono">H</span>;
  return <FileText size={11} className="text-gray-400" />;
}

function formatBytes(chars: number): string {
  if (chars < 1000) return `${chars} chars`;
  if (chars < 1_000_000) return `${(chars / 1000).toFixed(1)}K chars`;
  return `${(chars / 1_000_000).toFixed(2)}M chars`;
}

export default function StoryFileManifest({ files, totalChars }: StoryFileManifestProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const grouped: Record<string, string[]> = {};
  for (const file of files) {
    const parts = file.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)';
    const name = parts[parts.length - 1];
    if (!grouped[dir]) grouped[dir] = [];
    grouped[dir].push(name);
  }

  const dirs = Object.keys(grouped).sort();

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileCode size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            File Manifest
          </span>
          <span className="bg-gray-100 text-gray-500 text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-200">
            {files.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalChars !== undefined && (
            <span className="text-[10px] text-gray-400 font-mono">{formatBytes(totalChars)}</span>
          )}
          {isExpanded
            ? <ChevronDown size={13} className="text-gray-400" />
            : <ChevronRight size={13} className="text-gray-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 max-h-72 overflow-y-auto">
          {files.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-400">No source files found</div>
          ) : (
            <div className="py-1">
              {dirs.map((dir) => (
                <div key={dir}>
                  {dir !== '(root)' && (
                    <div className="flex items-center gap-1.5 px-3 py-1 mt-1 bg-gray-50">
                      <ChevronRight size={10} className="text-gray-400" />
                      <span className="text-[10px] text-gray-500 font-mono truncate">{dir}/</span>
                    </div>
                  )}
                  {grouped[dir].map((filename) => (
                    <div
                      key={`${dir}/${filename}`}
                      className="flex items-center gap-2 px-3 py-1 hover:bg-gray-50 group"
                    >
                      <div className="w-5 flex items-center justify-center shrink-0">
                        {getFileIcon(filename)}
                      </div>
                      <span className="text-[11px] text-gray-600 font-mono truncate group-hover:text-gray-900 transition-colors">
                        {filename}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
