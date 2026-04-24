'use client';

import { useEffect, useState } from 'react';
import { api, School } from '@/lib/api';
import { Settings, RefreshCw, Copy, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiBase, setApiBase] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const base = localStorage.getItem('sc_api_base') || 'http://localhost:3000/api';
    setApiBase(base);
    api.schools.list().then(setSchools).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const saveBase = () => {
    localStorage.setItem('sc_api_base', apiBase);
    window.location.reload();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">API Configuration</h2>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Backend API Base URL</label>
          <div className="flex gap-2">
            <input type="text" value={apiBase} onChange={(e) => setApiBase(e.target.value)} className="input flex-1" placeholder="https://your-api.railway.app/api" />
            <button onClick={saveBase} className="btn-primary">Save &amp; Reload</button>
          </div>
          <p className="text-xs text-gray-400 mt-1">No trailing slash. Example: https://schoolconnect.up.railway.app/api</p>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Schools</h2>
          <button onClick={() => { setLoading(true); api.schools.list().then(setSchools).finally(() => setLoading(false)); }} className="btn-secondary text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <p className="text-sm text-gray-500">Copy School IDs to use in teacher CSV uploads.</p>
        {loading ? (
          <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
        ) : schools.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No schools found. Create one via the backend API.</p>
        ) : (
          <div className="space-y-2">
            {schools.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs font-mono text-gray-500 truncate">{s.id}</p>
                </div>
                <button onClick={() => copy(s.id, s.id)} className="text-gray-400 hover:text-indigo-600 flex-shrink-0">
                  {copied === s.id ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">CSV Upload Guide</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>2 separate CSV files</strong> are used for bulk data import:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="font-semibold text-indigo-800 mb-1">students.csv</p>
              <p className="text-xs text-indigo-700">Contains student + parent data together. Each row creates one student and one linked parent.</p>
              <p className="text-xs font-mono text-indigo-600 mt-2">studentName, rollNumber, grade, section, parentName, parentPhone, languagePreference</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="font-semibold text-green-800 mb-1">teachers.csv</p>
              <p className="text-xs text-green-700">Contains teacher data. Requires schoolId. Class IDs are pipe-separated.</p>
              <p className="text-xs font-mono text-green-600 mt-2">name, phone, subject, schoolId, classIds</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}