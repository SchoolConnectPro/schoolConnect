'use client';

import { useEffect, useState } from 'react';
import { api, Student } from '@/lib/api';
import { GraduationCap, Search, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { langLabel } from '@/lib/utils';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setStudents(await api.students.list());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.parent?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.rollNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <span className="text-sm text-gray-500">{filtered.length} students</span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Student</th>
              <th className="table-th">Roll No.</th>
              <th className="table-th">Class</th>
              <th className="table-th">Parent</th>
              <th className="table-th">Phone</th>
              <th className="table-th">Language</th>
              <th className="table-th">Opted In</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="table-td"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-td text-center py-12 text-gray-400">
                  <GraduationCap className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  {search ? 'No students match your search' : 'No students yet. Upload a CSV to get started.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="table-td font-medium text-gray-900">{s.name}</td>
                  <td className="table-td font-mono text-gray-500">{s.rollNumber || '—'}</td>
                  <td className="table-td">
                    {s.class ? (
                      <span className="badge bg-indigo-50 text-indigo-700">Grade {s.class.grade}{s.class.section}</span>
                    ) : '—'}
                  </td>
                  <td className="table-td">{s.parent?.name || '—'}</td>
                  <td className="table-td font-mono text-sm">{s.parent?.phone || '—'}</td>
                  <td className="table-td">
                    <span className="badge bg-gray-100 text-gray-600">{langLabel(s.parent?.languagePreference || 'EN')}</span>
                  </td>
                  <td className="table-td">
                    {s.parent?.optedIn ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
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