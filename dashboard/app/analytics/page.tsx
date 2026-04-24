'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, TeacherStat, AnalyticsData } from '@/lib/api';
import {
  BarChart2, RefreshCw, TrendingUp, Users, Bell,
  CheckCircle, XCircle, Clock, Loader2, ChevronUp, ChevronDown,
  Calendar, ExternalLink,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ATTENDANCE:    { label: 'Attendance',    color: 'text-blue-700',   bg: 'bg-blue-500' },
  BROADCAST:     { label: 'Broadcast',     color: 'text-purple-700', bg: 'bg-purple-500' },
  HOMEWORK:      { label: 'Homework',      color: 'text-yellow-700', bg: 'bg-yellow-500' },
  TEST_REMINDER: { label: 'Test Reminder', color: 'text-orange-700', bg: 'bg-orange-500' },
  EVENT:         { label: 'Event',         color: 'text-green-700',  bg: 'bg-green-500' },
  EMERGENCY:     { label: 'Emergency',     color: 'text-red-700',    bg: 'bg-red-500' },
};

// DELIVERED removed — only show the 3 actionable statuses
const DELIVERY_CONFIG: Record<string, { label: string; dot: string }> = {
  SENT:   { label: 'Sent',   dot: 'bg-blue-500' },
  QUEUED: { label: 'Queued', dot: 'bg-yellow-500' },
  FAILED: { label: 'Failed', dot: 'bg-red-500' },
};

type Period = 'today' | '7d' | '30d' | '90d' | '180d' | 'year' | 'all';

const PERIOD_OPTIONS: { value: Period; label: string; description: string }[] = [
  { value: 'today',  label: 'Today',           description: 'Activity since midnight' },
  { value: '7d',     label: 'Last 7 Days',      description: 'Rolling 7-day window' },
  { value: '30d',    label: 'Last 30 Days',     description: 'Rolling 30-day window' },
  { value: '90d',    label: 'Last 3 Months',    description: 'Rolling 90-day window' },
  { value: '180d',   label: 'Last 6 Months',    description: 'Rolling 180-day window' },
  { value: 'year',   label: 'This Year',        description: `Jan 1 – today` },
  { value: 'all',    label: 'All Time',         description: 'Complete history' },
];

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

type SortField = 'name' | 'totalNotifications' | 'totalAttendanceMarked' | 'totalRecipients' | 'lastActive';

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30d');
  const [sortField, setSortField] = useState<SortField>('totalNotifications');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const viewTeacherNotifications = (teacherName: string) => {
    const params = new URLSearchParams({ teacher: teacherName, period });
    router.push(`/notifications?${params.toString()}`);
  };

  const load = async (p: Period = period) => {
    setLoading(true); setError(null);
    try { setData(await api.analytics.get(p)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    load(p);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortOrder('desc'); }
  };

  const sortedTeachers: TeacherStat[] = data
    ? [...data.teachers].sort((a, b) => {
        let av: number | string = 0;
        let bv: number | string = 0;
        if (sortField === 'name') { av = a.name; bv = b.name; }
        else if (sortField === 'lastActive') { av = a.lastActive || ''; bv = b.lastActive || ''; }
        else { av = a[sortField] as number; bv = b[sortField] as number; }
        if (av < bv) return sortOrder === 'asc' ? -1 : 1;
        if (av > bv) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      })
    : [];

  const maxNotifs = Math.max(...(data?.teachers.map((t) => t.totalNotifications) ?? [0]), 1);
  const maxAttendance = Math.max(...(data?.teachers.map((t) => t.totalAttendanceMarked) ?? [0]), 1);
  const maxRecipients = Math.max(...(data?.teachers.map((t) => t.totalRecipients) ?? [0]), 1);
  const totalNotifications = data
    ? Object.values(data.overview.byType).reduce((s, v) => s + v.count, 0)
    : 0;

  const SortBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
    >
      {children}
      {sortField === field
        ? sortOrder === 'asc'
          ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
          : <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
        : <ChevronDown className="w-3.5 h-3.5 text-gray-300" />}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={() => load()} className="btn-secondary mt-3">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Teacher Engagement Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">How actively each teacher communicates with parents</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period filter dropdown */}
          <div className="relative flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            <select
              value={period}
              onChange={(e) => handlePeriod(e.target.value as Period)}
              className="text-xs font-medium text-gray-700 bg-transparent border-none outline-none cursor-pointer pr-1 appearance-none"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0 pointer-events-none" />
          </div>

          {/* Active period badge */}
          <span className="text-xs text-gray-400 hidden sm:block">
            {PERIOD_OPTIONS.find((o) => o.value === period)?.description}
          </span>

          <button onClick={() => load()} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Bell} label="Total Notifications" value={totalNotifications}
          color="bg-indigo-50 text-indigo-600" />
        <StatCard icon={Users} label="Total Recipients"
          value={Object.values(data.overview.byType).reduce((s, v) => s + v.recipients, 0).toLocaleString()}
          color="bg-blue-50 text-blue-600" />
        <StatCard icon={CheckCircle} label="Delivery Rate"
          value={`${data.overview.deliveryRate}%`}
          sub={`${data.overview.totalMessages.toLocaleString()} messages sent`}
          color="bg-green-50 text-green-600" />
        <StatCard icon={TrendingUp} label="Active Teachers"
          value={data.teachers.filter((t) => t.totalNotifications > 0).length}
          sub={`of ${data.teachers.length} total`}
          color="bg-purple-50 text-purple-600" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notification type breakdown */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Notifications by Type</h2>
          </div>
          {totalNotifications === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.keys(TYPE_CONFIG).map((type) => {
                const info = data.overview.byType[type];
                const count = info?.count || 0;
                const pct = totalNotifications > 0 ? Math.round((count / totalNotifications) * 100) : 0;
                const cfg = TYPE_CONFIG[type];
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.bg}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delivery stats — DELIVERED removed, showing Sent / Queued / Failed */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Message Delivery</h2>
          </div>
          {data.overview.totalMessages === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No messages sent yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-center py-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-gray-900">{data.overview.deliveryRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">delivery rate</p>
                  <p className="text-xs text-gray-400">{data.overview.totalMessages.toLocaleString()} total messages</p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-gray-100">
                {Object.entries(DELIVERY_CONFIG).map(([status, cfg]) => {
                  const count = data.overview.delivery[status] || 0;
                  const pct = data.overview.totalMessages > 0
                    ? Math.round((count / data.overview.totalMessages) * 100) : 0;
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        <span className="text-xs text-gray-500">{count.toLocaleString()} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${cfg.dot}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Top 5 teachers by notifications */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Top Teachers</h2>
            <span className="text-xs text-gray-400 ml-auto">by notifications</span>
          </div>
          {data.teachers.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No teachers yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {[...data.teachers]
                .sort((a, b) => b.totalNotifications - a.totalNotifications)
                .slice(0, 5)
                .map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => viewTeacherNotifications(t.name)}
                    className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors group text-left"
                    title={`View notifications by ${t.name}`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate group-hover:text-indigo-700">{t.name}</p>
                      <p className="text-xs text-gray-400 truncate">{t.subject || t.school?.name || '—'}</p>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-1.5">
                      <div>
                        <p className="text-sm font-bold text-indigo-600">{t.totalNotifications}</p>
                        <p className="text-xs text-gray-400">notifs</p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Teacher engagement table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Teacher Engagement Detail</h2>
          <span className="text-xs text-gray-400 ml-auto">{data.teachers.length} teachers</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">
                  <SortBtn field="name">Teacher</SortBtn>
                </th>
                <th className="table-th">Subject / School</th>
                <th className="table-th">
                  <SortBtn field="totalNotifications">Notifications</SortBtn>
                </th>
                <th className="table-th">Type Breakdown</th>
                <th className="table-th">
                  <SortBtn field="totalRecipients">Recipients</SortBtn>
                </th>
                <th className="table-th">
                  <SortBtn field="totalAttendanceMarked">Attendance</SortBtn>
                </th>
                <th className="table-th">
                  <SortBtn field="lastActive">Last Active</SortBtn>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTeachers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-td text-center py-12 text-gray-400">
                    No teachers found
                  </td>
                </tr>
              ) : (
                sortedTeachers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="table-td">
                      <div>
                        <button
                          onClick={() => viewTeacherNotifications(t.name)}
                          className="group flex items-center gap-1.5 text-left"
                          title={`View notifications by ${t.name}`}
                        >
                          <div>
                            <p className="font-medium text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">{t.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{t.phone}</p>
                          </div>
                          <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-0.5" />
                        </button>
                      </div>
                    </td>
                    <td className="table-td text-sm text-gray-500">
                      {t.subject && <span className="badge bg-gray-100 text-gray-600 mr-1">{t.subject}</span>}
                      {t.school?.name || '—'}
                    </td>
                    <td className="table-td">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{t.totalNotifications}</span>
                        </div>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${maxNotifs > 0 ? Math.round((t.totalNotifications / maxNotifs) * 100) : 0}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(t.byType).length === 0 ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          Object.entries(t.byType)
                            .sort((a, b) => b[1] - a[1])
                            .map(([type, count]) => {
                              const cfg = TYPE_CONFIG[type];
                              return (
                                <span key={type}
                                  className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg?.color || 'text-gray-600'} bg-gray-100`}
                                  title={cfg?.label || type}>
                                  {cfg?.label?.slice(0, 4) || type.slice(0, 4)} {count}
                                </span>
                              );
                            })
                        )}
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-gray-700">{t.totalRecipients.toLocaleString()}</span>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full"
                            style={{ width: `${maxRecipients > 0 ? Math.round((t.totalRecipients / maxRecipients) * 100) : 0}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-gray-700">{t.totalAttendanceMarked}</span>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-400 rounded-full"
                            style={{ width: `${maxAttendance > 0 ? Math.round((t.totalAttendanceMarked / maxAttendance) * 100) : 0}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="table-td text-xs text-gray-500">
                      {t.lastActive ? formatDate(t.lastActive) : <span className="text-gray-300">Never</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}