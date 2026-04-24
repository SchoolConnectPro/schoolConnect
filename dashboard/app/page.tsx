'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Notification, AttendanceLog } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  GraduationCap, BookOpen, Users, School, Upload, Megaphone,
  CalendarCheck, ArrowRight, CheckCircle, XCircle, Clock,
  Plug, RefreshCw
} from 'lucide-react';

interface Stats {
  students: number;
  teachers: number;
  parents: number;
  classes: number;
  optedIn: number;
}

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/students', desc: 'List students (paginated, search, filter, sort)' },
  { method: 'POST', path: '/api/students', desc: 'Create student + parent together' },
  { method: 'PATCH', path: '/api/students/:id', desc: 'Update student and/or parent fields' },
  { method: 'DELETE', path: '/api/students/:id', desc: 'Delete student + parent + all related data' },
  { method: 'GET', path: '/api/teachers', desc: 'List all teachers with assigned classes' },
  { method: 'POST', path: '/api/teachers', desc: 'Register a new teacher' },
  { method: 'GET', path: '/api/parents', desc: 'List parents (filter: schoolId, classId, optedIn)' },
  { method: 'PATCH', path: '/api/parents/:id', desc: 'Update opt-in status or language preference' },
  { method: 'POST', path: '/api/parents/:id/opt-in', desc: 'Opt a parent in to WhatsApp messages' },
  { method: 'POST', path: '/api/parents/:id/opt-out', desc: 'Opt a parent out of WhatsApp messages' },
  { method: 'GET', path: '/api/classes', desc: 'List all classes with student counts' },
  { method: 'GET', path: '/api/classes/:id/parents', desc: 'All parents in a specific class' },
  { method: 'GET', path: '/api/attendance', desc: 'Recent attendance logs (last 50)' },
  { method: 'GET', path: '/api/notifications', desc: 'Recent notifications (last 50)' },
  { method: 'GET', path: '/api/notifications/:id', desc: 'Single notification with delivery stats' },
  { method: 'GET', path: '/api/schools', desc: 'List all schools' },
  { method: 'POST', path: '/api/test-message', desc: 'Send a test WhatsApp message' },
  { method: 'POST', path: '/webhook/twilio', desc: 'Incoming WhatsApp message handler' },
  { method: 'POST', path: '/webhook/twilio/status', desc: 'Twilio delivery status callback' },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700',
  POST: 'bg-green-100 text-green-700',
  PATCH: 'bg-yellow-100 text-yellow-700',
  DELETE: 'bg-red-100 text-red-700',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentNotifs, setRecentNotifs] = useState<Notification[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [students, teachers, parents, classes, notifs, attendance] = await Promise.all([
        api.students.list({ limit: 1 }),
        api.teachers.list(),
        api.parents.list(),
        api.classes.list(),
        api.notifications.list().catch(() => [] as Notification[]),
        api.attendance.list().catch(() => [] as AttendanceLog[]),
      ]);
      setStats({
        students: students.meta.total,
        teachers: teachers.length,
        parents: parents.length,
        classes: classes.length,
        optedIn: parents.filter((p) => p.optedIn).length,
      });
      setRecentNotifs(notifs.slice(0, 5));
      setRecentAttendance(attendance.slice(0, 5));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Could not connect to backend</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
            <p className="text-xs text-red-500 mt-1">Make sure the API base URL is correct (top-right input).</p>
          </div>
          <button onClick={load} className="ml-auto text-red-600 hover:text-red-800">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={GraduationCap} label="Students" value={stats?.students} color="blue" loading={loading} />
        <StatCard icon={BookOpen} label="Teachers" value={stats?.teachers} color="green" loading={loading} />
        <StatCard icon={Users} label="Parents Enrolled" value={stats?.parents} color="orange" loading={loading} />
        <StatCard icon={School} label="Classes" value={stats?.classes} color="purple" loading={loading} />
      </div>

      {/* Opted-in banner */}
      {stats && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-indigo-600" />
          <span className="text-sm text-indigo-800">
            <strong>{stats.optedIn}</strong> of <strong>{stats.parents}</strong> parents are opted-in to WhatsApp notifications
            {stats.parents > 0 && (
              <span className="ml-2 text-indigo-600">
                ({Math.round((stats.optedIn / stats.parents) * 100)}%)
              </span>
            )}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/upload', icon: Upload, label: 'Upload CSV', color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
              { href: '/broadcast', icon: Megaphone, label: 'Broadcast', color: 'bg-green-50 text-green-700 hover:bg-green-100' },
              { href: '/attendance', icon: CalendarCheck, label: 'Attendance', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
              { href: '/students', icon: GraduationCap, label: 'Students', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-colors ${color}`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Notifications</h2>
            <Link href="/notifications" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} />)}</div>
          ) : recentNotifs.length === 0 ? (
            <EmptyState text="No notifications yet" />
          ) : (
            <div className="space-y-2">
              {recentNotifs.map((n) => (
                <div key={n.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${n.status === 'SENT' ? 'bg-green-500' : n.status === 'FAILED' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{n.type}</p>
                    <p className="text-xs text-gray-500 truncate">{n.message}</p>
                    <p className="text-xs text-gray-400">{formatDate(n.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Attendance */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Attendance</h2>
            <Link href="/attendance" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} />)}</div>
          ) : recentAttendance.length === 0 ? (
            <EmptyState text="No attendance logs yet" />
          ) : (
            <div className="space-y-2">
              {recentAttendance.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.status === 'PRESENT' ? 'bg-green-500' : a.status === 'ABSENT' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{a.student?.name}</p>
                    <p className="text-xs text-gray-500">
                      Grade {a.student?.class?.grade}{a.student?.class?.section} · {a.status}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(a.createdAt).split(',')[0]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* API Endpoints Reference */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plug className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Available API Endpoints</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-th rounded-tl-lg w-20">Method</th>
                <th className="table-th w-64">Endpoint</th>
                <th className="table-th rounded-tr-lg">Description</th>
              </tr>
            </thead>
            <tbody>
              {API_ENDPOINTS.map((ep, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="table-td">
                    <span className={`badge font-mono text-xs ${METHOD_COLORS[ep.method] || 'bg-gray-100 text-gray-700'}`}>
                      {ep.method}
                    </span>
                  </td>
                  <td className="table-td font-mono text-xs text-gray-600">{ep.path}</td>
                  <td className="table-td text-gray-600">{ep.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, color, loading
}: {
  icon: React.ElementType;
  label: string;
  value?: number;
  color: 'blue' | 'green' | 'orange' | 'purple';
  loading: boolean;
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        {loading ? (
          <div className="h-7 w-12 bg-gray-200 rounded animate-pulse mb-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        )}
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function Skeleton() {
  return <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-6">
      <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}