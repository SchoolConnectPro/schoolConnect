'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Upload, GraduationCap, BookOpen,
  Users, Megaphone, CalendarCheck, Bell, Plug, Settings, X,
  BarChart2, LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

type SectionHeader = {
  section: string;
};

type NavEntry = NavItem | SectionHeader;

function isNavItem(entry: NavEntry): entry is NavItem {
  return 'href' in entry;
}

const nav: NavEntry[] = [
  { section: 'Main' },
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'CSV Upload', icon: Upload, badge: 'New' },
  { href: '/students', label: 'Students', icon: GraduationCap },
  { href: '/teachers', label: 'Teachers', icon: BookOpen },
  { href: '/parents', label: 'Parents', icon: Users },
  { section: 'Communication' },
  { href: '/broadcast', label: 'Broadcast', icon: Megaphone },
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { section: 'Insights' },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { section: 'System' },
  { href: '/api-reference', label: 'API Reference', icon: Plug },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 z-30 flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-base">SchoolConnect</span>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {nav.map((entry, i) => {
            if (!isNavItem(entry)) {
              return (
                <p key={i} className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {entry.section}
                </p>
              );
            }

            const Icon = entry.icon;
            const isActive = pathname === entry.href;

            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{entry.label}</span>
                {entry.badge && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">
                    {entry.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Admin</p>
              <p className="text-xs text-gray-500 truncate">School Administrator</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}