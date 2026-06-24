'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, ShieldOff, X, Eye, EyeOff } from 'lucide-react';

type Props = {
  onAdminChange: (isAdmin: boolean) => void;
};

export function AdminBar({ onAdminChange }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Keep a stable ref to onAdminChange so the mount effect never re-runs
  const onAdminChangeRef = useRef(onAdminChange);
  useEffect(() => { onAdminChangeRef.current = onAdminChange; });

  // Check admin status on mount ONLY (empty dep array)
  useEffect(() => {
    fetch('/api/admin/auth')
      .then(r => r.json())
      .then(d => {
        setIsAdmin(d.isAdmin);
        onAdminChangeRef.current(d.isAdmin);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function login() {
    if (!passphrase.trim()) return;
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) {
      setIsAdmin(true);
      onAdminChange(true);
      setShowInput(false);
      setPassphrase('');
    } else {
      setError('Wrong passphrase. Try again.');
    }
  }

  async function logout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setIsAdmin(false);
    onAdminChange(false);
  }

  if (isAdmin) {
    return (
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
        <Shield className="w-4 h-4 text-amber-600" />
        <span className="text-xs font-semibold text-amber-700">Admin Mode</span>
        <span className="text-xs text-amber-500">· edit & delete enabled</span>
        <button
          onClick={logout}
          className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 transition-colors"
        >
          <ShieldOff className="w-3.5 h-3.5" /> Exit
        </button>
      </div>
    );
  }

  if (showInput) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Enter admin passphrase…"
            autoFocus
            className={`pl-3 pr-8 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 w-56 ${error ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
          />
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        {error && <span className="text-xs text-red-500">{error}</span>}
        <button
          onClick={login}
          disabled={loading || !passphrase.trim()}
          className="px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {loading ? '…' : 'Unlock'}
        </button>
        <button onClick={() => { setShowInput(false); setError(''); setPassphrase(''); }} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center">
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-400 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 transition-all"
    >
      <Shield className="w-3.5 h-3.5" />
      Admin
    </button>
  );
}
