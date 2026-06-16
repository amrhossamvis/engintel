'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Copy, Check, ChevronDown, ChevronUp,
  Edit3, Save, X, ListChecks, BookOpen, Hash,
} from 'lucide-react';
import { StoryUserStory } from '@/types';

interface StoryCardProps {
  story: StoryUserStory;
  index: number;
  onUpdate: (updated: StoryUserStory) => void;
}

function formatForClipboard(story: StoryUserStory): string {
  const ac = story.acceptanceCriteria.map((c, i) => `  ${i + 1}. ${c}`).join('\n');
  return `USER STORY
──────────────────────────────────────────
Title: ${story.title}

Description:
${story.description}

Acceptance Criteria:
${ac}
──────────────────────────────────────────`;
}

export default function StoryCard({ story, index, onUpdate }: StoryCardProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const [editTitle, setEditTitle] = useState(story.title);
  const [editDescription, setEditDescription] = useState(story.description);
  const [editCriteria, setEditCriteria] = useState<string[]>(story.acceptanceCriteria);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && titleRef.current) titleRef.current.focus();
  }, [isEditing]);

  function handleCopy() {
    navigator.clipboard.writeText(formatForClipboard(story)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleEditStart() {
    setEditTitle(story.title);
    setEditDescription(story.description);
    setEditCriteria([...story.acceptanceCriteria]);
    setIsEditing(true);
    setIsExpanded(true);
  }

  function handleEditCancel() {
    setEditTitle(story.title);
    setEditDescription(story.description);
    setEditCriteria([...story.acceptanceCriteria]);
    setIsEditing(false);
  }

  function handleEditSave() {
    onUpdate({
      ...story,
      title: editTitle.trim() || story.title,
      description: editDescription.trim() || story.description,
      acceptanceCriteria: editCriteria.filter((c) => c.trim() !== ''),
    });
    setIsEditing(false);
  }

  function handleCriterionChange(idx: number, value: string) {
    setEditCriteria((prev) => { const next = [...prev]; next[idx] = value; return next; });
  }

  function handleAddCriterion() {
    setEditCriteria((prev) => [...prev, 'Given... When... Then...']);
  }

  function handleRemoveCriterion(idx: number) {
    setEditCriteria((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className={`
      group relative bg-white border rounded-2xl overflow-hidden transition-all duration-200 shadow-sm
      ${isEditing ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}
    `}>
      {/* Top accent bar */}
      <div className={`h-0.5 ${isEditing ? 'bg-amber-400' : 'bg-gradient-to-r from-[#e60000] to-rose-500'}`} />

      {/* Card Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="shrink-0 mt-0.5">
          <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center">
            <span className="text-[10px] font-bold text-[#e60000] font-mono">
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={titleRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gray-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors"
            />
          ) : (
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{story.title}</h3>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={handleEditSave}
                title="Save changes"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors text-xs font-medium"
              >
                <Save size={12} /> Save
              </button>
              <button
                onClick={handleEditCancel}
                title="Cancel editing"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCopy}
                title="Copy to clipboard (ADO format)"
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                  ${copied
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 opacity-0 group-hover:opacity-100'}
                `}
              >
                {copied ? <><Check size={12} />Copied!</> : <><Copy size={12} />Copy</>}
              </button>
              <button
                onClick={handleEditStart}
                title="Edit story"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Edit3 size={13} />
              </button>
              <button
                onClick={() => setIsExpanded((v) => !v)}
                title={isExpanded ? 'Collapse' : 'Expand'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <BookOpen size={11} className="text-gray-400" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Description</span>
            </div>
            {isEditing ? (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-2 text-xs text-gray-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors resize-none leading-relaxed font-mono"
              />
            ) : (
              <p className="text-xs text-gray-600 leading-relaxed pl-4 border-l-2 border-gray-200">
                {story.description}
              </p>
            )}
          </div>

          {/* Acceptance Criteria */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ListChecks size={11} className="text-gray-400" />
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Acceptance Criteria
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  ({isEditing ? editCriteria.length : story.acceptanceCriteria.length})
                </span>
              </div>
              {isEditing && (
                <button
                  onClick={handleAddCriterion}
                  className="text-[10px] text-amber-600 hover:text-amber-700 flex items-center gap-1 font-medium"
                >
                  + Add criterion
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {isEditing
                ? editCriteria.map((criterion, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="mt-2 shrink-0"><Hash size={9} className="text-gray-300" /></div>
                      <textarea
                        value={criterion}
                        onChange={(e) => handleCriterionChange(idx, e.target.value)}
                        rows={2}
                        className="flex-1 bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-[11px] text-gray-700 outline-none focus:border-amber-400 transition-colors resize-none font-mono leading-relaxed"
                      />
                      <button
                        onClick={() => handleRemoveCriterion(idx)}
                        className="mt-1.5 p-1 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))
                : story.acceptanceCriteria.map((criterion, idx) => {
                    const lower = criterion.toLowerCase();
                    const isGiven = lower.startsWith('given');
                    const isWhen = lower.startsWith('when');
                    const isThen = lower.startsWith('then');
                    return (
                      <div key={idx} className="flex items-start gap-2.5">
                        <div className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full
                          ${isGiven ? 'bg-blue-400' : isWhen ? 'bg-amber-400' : isThen ? 'bg-emerald-400' : 'bg-gray-300'}`}
                        />
                        <p className={`text-[11px] leading-relaxed
                          ${isGiven ? 'text-blue-700' : isWhen ? 'text-amber-700' : isThen ? 'text-emerald-700' : 'text-gray-600'}`}
                        >
                          {criterion}
                        </p>
                      </div>
                    );
                  })}
            </div>
          </div>

          {/* Story ID Footer */}
          <div className="pt-1 flex items-center justify-between border-t border-gray-100">
            <span className="text-[9px] text-gray-300 font-mono">ID: {story.id}</span>
            {!isEditing && (
              <button
                onClick={handleCopy}
                className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
              >
                <Copy size={9} /> Copy for ADO
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
