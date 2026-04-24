'use client';

import { useEffect, useState } from 'react';
import { api, Parent } from '@/lib/api';
import { Users, Search, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { langLabel } from '@/lib/utils';

export default function ParentsPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'opted-in' | 'opted-out'>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setParents(await api.parents.list());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleOptIn = async (parent: Parent) => {
    setUpdating(parent.id);
    try {
      if (parent.optedIn) {
        await api.parents.optOut(parent.id);
      } else {
        await api.parents.optIn(parent.id);
      }
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  };

  const updateLang = async (parent: Parent, lang: string) => {
    setUpdating(parent.id);
    try {
      await api.parents.update(parent.id, { languagePreference: lang });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  };

  const filtered = parents
    .filter((p) => filter === 'all' || (filter === 'opted-in' ? p.optedIn : !p.optedIn))
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search) ||
      p.student?.name?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search parents..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'opted-in', 'opted-out'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600'}`}>
              {f === 'all' ? 'All' : f === 'opted-in' ? '✓ Opted In' : '✗ Opted Out'}
            </button>
          ))}
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <span className="text-sm text-gray-500">{filtered.length} parents</span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Parent Name</th>
              <th className="table-th">Phone (WhatsApp)</th>
              <th className="table-th">Student</th>
              <th className="table-th">Class</th>
              <th className="table-th">Language</th>
              <th className="table-th">Opted In</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(7)].map((_, j) => <td key={j} className="table-td"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-td text-center py-12 text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  {search ? 'No parents match your search' : 'No parents yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="table-td font-medium text-gray-900">{p.name}</td>
                  <td className="table-td font-mono text-sm">{p.phone}</td>
                  <td className="table-td">{p.student?.name || '—'}</td>
                  <td className="table-td">
                    {p.student?.class ? (
                      <span className="badge bg-indigo-50 text-indigo-700">Grade {p.student.class.grade}{p.student.class.section}</span>
                    ) : '—'}
                  </td>
                  <td className="table-td">
                    <select
                      value={p.languagePreference}
                      onChange={(e) => updateLang(p, e.target.value)}
                      disabled={updating === p.id}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="EN">English</option>
                      <option value="HI">Hindi</option>
                      <option value="PA">Punjabi</option>
                    </select>
                  </td>
                  <td className="table-td">
                    {p.optedIn ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </td>
                  <td className="table-td">
                    <button
                      onClick={() => toggleOptIn(p)}
                      disabled={updating === p.id}
                      className={`text-xs px-2 py-1 rounded font-medium transition-colors ${p.optedIn ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                    >
                      {updating === p.id ? '...' : p.optedIn ? 'Opt Out' : 'Opt In'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}