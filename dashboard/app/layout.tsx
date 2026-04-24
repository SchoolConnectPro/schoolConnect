'use client';

import './globals.css';
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Menu, RefreshCw } from 'lucide-react';
import { usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/upload': 'CSV Upload',
  '/students': 'Students',
  '/teachers': 'Teachers',
  '/parents': 'Parents',
  '/broadcast': 'Broadcast',
  '/attendance': 'Attendance',
  '/notifications': 'Notifications',
  '/analytics': 'Analytics',
  '/api-reference': 'API Reference',
  '/settings': 'Settings',
};

function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? 'SchoolConnect';

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area — offset by sidebar on large screens */}
      <div className="lg:pl-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 flex-1">{title}</h1>
          <div className="flex items-center gap-2">
            <ApiBaseInput />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

function ApiBaseInput() {
  const [value, setValue] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sc_api_base') || 'http://localhost:3000/api';
    }
    return 'http://localhost:3000/api';
  });

  const save = () => {
    localStorage.setItem('sc_api_base', value);
    window.location.reload();
  };

  return (
    <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">API:</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        className="text-xs text-gray-700 bg-transparent outline-none w-56"
        placeholder="https://your-api.railway.app/api"
      />
      <button onClick={save} title="Save & reload" className="text-gray-400 hover:text-indigo-600">
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>SchoolConnect Admin</title>
        <meta name="description" content="SchoolConnect Admin Dashboard" />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}