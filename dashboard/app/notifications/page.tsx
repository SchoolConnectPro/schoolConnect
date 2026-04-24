'use client';

import { useEffect, useState } from 'react';
import { api, Notification } from '@/lib/api';
import { Bell, RefreshCw, Search } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try { setNotifs(await api.notifications.list()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = notifs.filter((n) =>
    n.type.toLowerCase().includes(search.toLowerCase()) ||
    n.message.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) =>
    s === 'SENT' ? 'bg-green-100 text-green-700' :
    s === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search notifications..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" />
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <span className="text-sm text-gray-500">{filtered.length} records</span>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Type</th>
              <th className="table-th">Message</th>
              <th className="table-th">Target Class</th>
              <th className="table-th">Sent By</th>
              <th className="table-th">Status</th>
              <th className="table-th">Delivered</th>
              <th className="table-th">Date</th>
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
                  <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  No notifications yet.
                </td>
              </tr>
            ) : (
              filtered.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="table-td"><span className="badge bg-indigo-50 text-indigo-700">{n.type}</span></td>
                  <td className="table-td max-w-xs truncate text-gray-700">{n.message}</td>
                  <td className="table-td">
                    {n.targetClass ? <span className="badge bg-gray-100 text-gray-600">Grade {n.targetClass.grade}{n.targetClass.section}</span> : '—'}
                  </td>
                  <td className="table-td">{n.createdByTeacher?.name || '—'}</td>
                  <td className="table-td"><span className={`badge ${statusColor(n.status)}`}>{n.status}</span></td>
                  <td className="table-td">{n._count?.messageLogs ?? '—'}</td>
                  <td className="table-td text-gray-500">{formatDate(n.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}