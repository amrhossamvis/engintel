'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, FolderOpen, X } from 'lucide-react';

interface StoryModuleSelectorProps {
  modules: string[];
  selectedModule: string | null;
  onSelect: (module: string) => void;
  disabled?: boolean;
  analyzedModules?: Set<string>;
}

export default function StoryModuleSelector({
  modules,
  selectedModule,
  onSelect,
  disabled = false,
  analyzedModules = new Set(),
}: StoryModuleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? modules.filter((m) => m.toLowerCase().includes(query.toLowerCase().trim()))
    : modules;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  function handleSelect(mod: string) {
    onSelect(mod);
    setIsOpen(false);
    setQuery('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onSelect('');
    setQuery('');
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((v) => !v)}
        className={`
          w-full flex items-center justify-between gap-2 px-3 py-2.5
          bg-white border rounded-xl text-sm transition-all duration-150 shadow-sm
          ${disabled ? 'opacity-50 cursor-not-allowed border-gray-200' : 'cursor-pointer hover:border-gray-400 border-gray-300'}
          ${isOpen ? 'border-[#e60000] ring-2 ring-red-100' : ''}
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen size={15} className={selectedModule ? 'text-[#e60000]' : 'text-gray-400'} />
          <span className={`truncate ${selectedModule ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
            {selectedModule || 'Select a module…'}
          </span>
          {selectedModule && analyzedModules.has(selectedModule) && (
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500" title="Cached analysis available" />
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedModule && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search modules…"
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
            {filtered.length} of {modules.length} modules
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-400">
                No modules match &quot;{query}&quot;
              </div>
            ) : (
              filtered.map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => handleSelect(mod)}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors duration-100
                    ${mod === selectedModule
                      ? 'bg-red-50 text-[#e60000] font-medium'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  <FolderOpen size={13} className={mod === selectedModule ? 'text-[#e60000]' : 'text-gray-400'} />
                  <span className="truncate flex-1">{mod}</span>
                  {analyzedModules.has(mod) && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-80" title="Cached" />
                  )}
                  {mod === selectedModule && (
                    <span className="ml-1 text-xs text-[#e60000] shrink-0">selected</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
