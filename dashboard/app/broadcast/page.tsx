'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Megaphone, Send, CheckCircle, XCircle } from 'lucide-react';

export default function BroadcastPage() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const send = async () => {
    if (!phone.trim() || !message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await api.testMessage(phone.trim(), message.trim());
      setResult({ ok: true, msg: `Sent! SID: ${res.messageSid}` });
    } catch (e: unknown) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Failed to send' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Test Message Tool</strong> — Send a WhatsApp message to any number via the backend.
        This uses the <code>/api/test-message</code> endpoint. For bulk broadcasts, teachers send
        messages via WhatsApp commands directly.
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Send Test WhatsApp Message</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+919876543210"
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">Include country code (e.g. +91 for India)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Type your message here..."
            className="input resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">{message.length} characters</p>
        </div>

        <button onClick={send} disabled={sending || !phone || !message} className="btn-primary w-full justify-center">
          <Send className="w-4 h-4" />
          {sending ? 'Sending...' : 'Send WhatsApp Message'}
        </button>

        {result && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {result.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {result.msg}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-3">How Teachers Broadcast</h3>
        <div className="space-y-3 text-sm text-gray-600">
          {[
            ['Mark Attendance', 'Teacher sends: "present 5A" or "absent 5A Arjun" via WhatsApp'],
            ['Send Notification', 'Teacher sends: "notify 5A Exam tomorrow at 9am" via WhatsApp'],
            ['Check Status', 'Teacher sends: "status" to see their assigned classes'],
          ].map(([title, desc]) => (
            <div key={title} className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-800">{title}</p>
                <p className="text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}