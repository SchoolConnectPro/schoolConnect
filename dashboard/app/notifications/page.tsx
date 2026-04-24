'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, Notification } from '@/lib/api';
import { Bell, RefreshCw, Search, X, Filter, Loader2, ChevronDown } from 'lucide-react';
import { formatDate } from '@/lib/utils';

type Period = 'today' | '7d' | '30d' | '90d' | '180d' | 'year' | 'all';

const PERIOD_LABELS: Record<string, string> = {
  today: 'Today',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 3 Months',
  '180d': 'Last 6 Months',
  year: 'This Year',
  all: 'All Time',
};

const TYPE_LABELS: Record<string, string> = {
  ATTENDANCE:    'Attendance',
  BROADCAST:     'Broadcast',
  HOMEWORK:      'Homework',
  TEST_REMINDER: 'Test Reminder',
  EVENT:         'Event',
  EMERGENCY:     'Emergency',
};

function getPeriodStart(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case 'today':  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '7d':     return new Date(Date.now() - 7   * 24 * 60 * 60 * 1000);
    case '30d':    return new Date(Date.now() - 30  * 24 * 60 * 60 * 1000);
    case '90d':    return new Date(Date.now() - 90  * 24 * 60 * 60 * 1000);
    case '180d':   return new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    case 'year':   return new Date(now.getFullYear(), 0, 1);
    default:       return null;
  }
}

const statusColor = (s: string) =>
  s === 'SENT'   ? 'bg-green-100 text-green-700' :
  s === 'FAILED' ? 'bg-red-100 text-red-700'     : 'bg-yellow-100 text-yellow-700';

function classLabel(n: Notification) {
  if (!n.targetClass) return null;
  return `Grade ${n.targetClass.grade}${n.targetClass.section}`;
}

// ─── Filter select component ──────────────────────────────────────────────────

function FilterSelect({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="relative flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm min-w-[130px]">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-xs font-medium bg-transparent border-none outline-none cursor-pointer pr-4 appearance-none w-full ${
          value ? 'text-indigo-600' : 'text-gray-500'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 pointer-events-none" />
    </div>
  );
}

// ─── Inner component ──────────────────────────────────────────────────────────

function NotificationsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL-driven filters (set by analytics page)
  const urlTeacher = searchParams.get('teacher') || '';
  const urlPeriod  = (searchParams.get('period') || '') as Period | '';

  const [notifs, setNotifs]         = useState<Notification[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  // UI filter states — teacher pre-populated from URL param
  const [filterTeacher, setFilterTeacher] = useState(urlTeacher);
  const [filterClass, setFilterClass]     = useState('');
  const [filterType, setFilterType]       = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try { setNotifs(await api.notifications.list()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Sync teacher dropdown when URL param changes (e.g. back/forward navigation)
  useEffect(() => { setFilterTeacher(urlTeacher); }, [urlTeacher]);

  // Derive unique filter options from loaded data
  const teacherOptions = useMemo(() =>
    [...new Set(notifs.map((n) => n.createdByTeacher?.name).filter(Boolean) as string[])].sort(),
    [notifs]
  );
  const classOptions = useMemo(() =>
    [...new Set(notifs.map(classLabel).filter(Boolean) as string[])].sort((a, b) => {
      // Sort by grade number then section
      const [, ga, sa] = a.match(/Grade (\d+)(.*)/) || [];
      const [, gb, sb] = b.match(/Grade (\d+)(.*)/) || [];
      return Number(ga) - Number(gb) || sa?.localeCompare(sb || '');
    }),
    [notifs]
  );
  const typeOptions = useMemo(() =>
    [...new Set(notifs.map((n) => n.type))].sort(),
    [notifs]
  );

  // Apply all filters
  const filtered = useMemo(() => {
    let list = notifs;

    // 1. Teacher filter (from dropdown, which may be pre-set from URL)
    if (filterTeacher) {
      list = list.filter((n) =>
        n.createdByTeacher?.name?.toLowerCase() === filterTeacher.toLowerCase()
      );
    }

    // 2. Period filter from URL
    if (urlPeriod && urlPeriod !== 'all') {
      const start = getPeriodStart(urlPeriod);
      if (start) list = list.filter((n) => new Date(n.createdAt) >= start);
    }

    // 3. Class filter
    if (filterClass) {
      list = list.filter((n) => classLabel(n) === filterClass);
    }

    // 4. Type filter
    if (filterType) {
      list = list.filter((n) => n.type === filterType);
    }

    // 5. Search box
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) =>
          n.type.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          (n.createdByTeacher?.name || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [notifs, filterTeacher, urlPeriod, filterClass, filterType, search]);

  const activeFilterCount = [filterTeacher, filterClass, filterType, search.trim()].filter(Boolean).length
    + (urlPeriod && urlPeriod !== 'all' ? 1 : 0);

  const clearAllFilters = () => {
    setFilterTeacher('');
    setFilterClass('');
    setFilterType('');
    setSearch('');
    router.push('/notifications');
  };

  const hasPeriodFilter = Boolean(urlPeriod && urlPeriod !== 'all');

  return (
    <div className="space-y-4">
      {/* Analytics drill-through banner */}
      {hasPeriodFilter && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
          <Filter className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <div className="flex-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-indigo-700 font-medium">Filtered from Analytics:</span>
            {filterTeacher && (
              <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full">
                Teacher: {filterTeacher}
              </span>
            )}
            <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full">
              Period: {PERIOD_LABELS[urlPeriod] || urlPeriod}
            </span>
          </div>
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear all
          </button>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search message or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>

        {/* Teacher filter */}
        <FilterSelect
          value={filterTeacher}
          onChange={setFilterTeacher}
          options={teacherOptions}
          placeholder="All Teachers"
        />

        {/* Class filter */}
        <FilterSelect
          value={filterClass}
          onChange={setFilterClass}
          options={classOptions}
          placeholder="All Classes"
        />

        {/* Type filter */}
        <FilterSelect
          value={filterType}
          onChange={(v) => setFilterType(v)}
          options={typeOptions.map((t) => t)}
          placeholder="All Types"
        />

        {/* Clear filters (only when something is active) */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 border border-gray-200"
          >
            <X className="w-3.5 h-3.5" />
            Clear
            <span className="bg-indigo-100 text-indigo-600 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
              {activeFilterCount}
            </span>
          </button>
        )}

        <button onClick={load} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>

        <span className="text-sm text-gray-500 ml-auto">{filtered.length} records</span>
      </div>

      {/* Active filter chips (when type filter is set, show a readable chip) */}
      {filterType && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">Active filters:</span>
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full">
            Type: {TYPE_LABELS[filterType] || filterType}
            <button onClick={() => setFilterType('')} className="ml-0.5 hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

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
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="table-td">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-td text-center py-12 text-gray-400">
                  <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  {activeFilterCount > 0
                    ? 'No notifications match the selected filters.'
                    : 'No notifications yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="table-td">
                    <span className="badge bg-indigo-50 text-indigo-700">
                      {TYPE_LABELS[n.type] || n.type}
                    </span>
                  </td>
                  <td className="table-td max-w-xs truncate text-gray-700">{n.message}</td>
                  <td className="table-td">
                    {n.targetClass
                      ? <span className="badge bg-gray-100 text-gray-600">{classLabel(n)}</span>
                      : '—'}
                  </td>
                  <td className="table-td text-sm text-gray-700">
                    {n.createdByTeacher?.name || '—'}
                  </td>
                  <td className="table-td">
                    <span className={`badge ${statusColor(n.status)}`}>{n.status}</span>
                  </td>
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

// ─── Page export — wraps inner component in Suspense ─────────────────────────

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <NotificationsContent />
    </Suspense>
  );
}