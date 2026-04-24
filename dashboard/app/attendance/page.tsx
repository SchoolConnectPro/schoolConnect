'use client';

import { useEffect, useState } from 'react';
import { api, AttendanceLog } from '@/lib/api';
import { CalendarCheck, RefreshCw, Search } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function AttendancePage() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try { setLogs(await api.attendance.list()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter((l) =>
    l.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.markedByTeacher?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) =>
    s === 'PRESENT' ? 'bg-green-100 text-green-700' :
    s === 'ABSENT' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search student or teacher..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" />
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <span className="text-sm text-gray-500">{filtered.length} records</span>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Student</th>
              <th className="table-th">Class</th>
              <th className="table-th">Status</th>
              <th className="table-th">Marked By</th>
              <th className="table-th">Parent Phone</th>
              <th className="table-th">Date & Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => <td key={j} className="table-td"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-td text-center py-12 text-gray-400">
                  <CalendarCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  No attendance records yet.
                </td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="table-td font-medium text-gray-900">{l.student?.name || '—'}</td>
                  <td className="table-td">
                    {l.student?.class ? <span className="badge bg-indigo-50 text-indigo-700">Grade {l.student.class.grade}{l.student.class.section}</span> : '—'}
                  </td>
                  <td className="table-td"><span className={`badge ${statusColor(l.status)}`}>{l.status}</span></td>
                  <td className="table-td">{l.markedByTeacher?.name || '—'}</td>
                  <td className="table-td font-mono text-sm">{l.student?.parent?.phone || '—'}</td>
                  <td className="table-td text-gray-500">{formatDate(l.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}