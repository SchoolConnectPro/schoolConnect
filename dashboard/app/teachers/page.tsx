'use client';

import { useEffect, useState } from 'react';
import { api, Teacher } from '@/lib/api';
import { BookOpen, Search, RefreshCw } from 'lucide-react';

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setTeachers(await api.teachers.list());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = teachers.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.phone.includes(search) ||
    t.subject?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search teachers..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" />
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <span className="text-sm text-gray-500">{filtered.length} teachers</span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Name</th>
              <th className="table-th">Phone (WhatsApp)</th>
              <th className="table-th">Subject</th>
              <th className="table-th">School</th>
              <th className="table-th">Classes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>{[...Array(5)].map((_, j) => <td key={j} className="table-td"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-td text-center py-12 text-gray-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  {search ? 'No teachers match your search' : 'No teachers yet. Upload a CSV to get started.'}
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="table-td font-medium text-gray-900">{t.name}</td>
                  <td className="table-td font-mono text-sm">{t.phone}</td>
                  <td className="table-td">{t.subject || <span className="text-gray-400">—</span>}</td>
                  <td className="table-td text-gray-600">{t.school?.name || '—'}</td>
                  <td className="table-td">
                    <div className="flex flex-wrap gap-1">
                      {t.classes?.length ? t.classes.map((tc, i) => (
                        <span key={i} className="badge bg-indigo-50 text-indigo-700">
                          Grade {tc.class.grade}{tc.class.section}
                        </span>
                      )) : <span className="text-gray-400 text-xs">No classes</span>}
                    </div>
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