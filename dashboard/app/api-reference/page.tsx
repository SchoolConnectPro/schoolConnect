'use client';

import { getApiBase } from '@/lib/api';
import { Plug, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

const ENDPOINTS = [
  {
    group: 'Students',
    items: [
      { method: 'GET', path: '/students', desc: 'List all students with class & parent info', body: null },
      { method: 'POST', path: '/students', desc: 'Create a student + parent together', body: `{\n  "studentName": "Arjun Sharma",\n  "rollNumber": "2024-A-01",\n  "classId": "clx...",\n  "parentName": "Rajesh Sharma",\n  "parentPhone": "+919876543210",\n  "languagePreference": "HI"\n}` },
    ],
  },
  {
    group: 'Teachers',
    items: [
      { method: 'GET', path: '/teachers', desc: 'List all teachers with assigned classes', body: null },
      { method: 'POST', path: '/teachers', desc: 'Register a new teacher', body: `{\n  "name": "Mrs. Sunita Verma",\n  "phone": "+919876500001",\n  "subject": "Mathematics",\n  "schoolId": "clx...",\n  "classIds": ["clx...", "clx..."]\n}` },
    ],
  },
  {
    group: 'Parents',
    items: [
      { method: 'GET', path: '/parents', desc: 'List parents (query: schoolId, classId, optedIn)', body: null },
      { method: 'PATCH', path: '/parents/:id', desc: 'Update opt-in or language', body: `{\n  "optedIn": true,\n  "languagePreference": "EN"\n}` },
      { method: 'POST', path: '/parents/:id/opt-in', desc: 'Opt parent in to WhatsApp', body: `{\n  "languagePreference": "HI"\n}` },
      { method: 'POST', path: '/parents/:id/opt-out', desc: 'Opt parent out of WhatsApp', body: '{}' },
    ],
  },
  {
    group: 'Classes',
    items: [
      { method: 'GET', path: '/classes', desc: 'List all classes with student counts', body: null },
      { method: 'GET', path: '/classes/:id/parents', desc: 'All parents in a specific class', body: null },
    ],
  },
  {
    group: 'Attendance',
    items: [
      { method: 'GET', path: '/attendance', desc: 'Recent attendance logs (last 50)', body: null },
    ],
  },
  {
    group: 'Notifications',
    items: [
      { method: 'GET', path: '/notifications', desc: 'Recent notifications (last 50)', body: null },
      { method: 'GET', path: '/notifications/:id', desc: 'Single notification with delivery stats', body: null },
    ],
  },
  {
    group: 'Schools',
    items: [
      { method: 'GET', path: '/schools', desc: 'List all schools', body: null },
    ],
  },
  {
    group: 'Utilities',
    items: [
      { method: 'POST', path: '/test-message', desc: 'Send a test WhatsApp message', body: `{\n  "phone": "+919876543210",\n  "message": "Hello from SchoolConnect!"\n}` },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700',
  POST: 'bg-green-100 text-green-700',
  PATCH: 'bg-yellow-100 text-yellow-700',
  DELETE: 'bg-red-100 text-red-700',
};

export default function ApiReferencePage() {
  const [copied, setCopied] = useState<string | null>(null);
  const base = typeof window !== 'undefined' ? getApiBase() : '';

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-3">
        <Plug className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-400">Base URL:</span>
        <code className="text-sm text-green-400 flex-1">{base}</code>
        <button onClick={() => copy(base, 'base')} className="text-gray-500 hover:text-white">
          {copied === 'base' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {ENDPOINTS.map((group) => (
        <div key={group.group} className="card overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">{group.group}</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {group.items.map((ep, i) => (
              <div key={i} className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className={`badge font-mono text-xs mt-0.5 ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-gray-800">{base}{ep.path}</code>
                      <button onClick={() => copy(`${base}${ep.path}`, `${i}-url`)} className="text-gray-400 hover:text-gray-600">
                        {copied === `${i}-url` ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{ep.desc}</p>
                  </div>
                </div>
                {ep.body && (
                  <div className="bg-gray-900 rounded-lg p-3 relative">
                    {(() => { const b = ep.body as string; return (
                      <>
                        <button onClick={() => copy(b, `${i}-body`)} className="absolute top-2 right-2 text-gray-500 hover:text-white">
                          {copied === `${i}-body` ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <pre className="text-xs text-green-400 font-mono overflow-x-auto">{b}</pre>
                      </>
                    ); })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}