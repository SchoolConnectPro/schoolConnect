// ─────────────────────────────────────────────
// SchoolConnect — Shared TypeScript Types
// ─────────────────────────────────────────────

export type IntentType =
  | 'ATTENDANCE'
  | 'BROADCAST'
  | 'TEST_REMINDER'
  | 'EVENT'
  | 'HOMEWORK'
  | 'EMERGENCY'
  | 'UNKNOWN';

/**
 * Structured data extracted by Claude from a teacher's WhatsApp message.
 */
export interface ParsedTeacherMessage {
  intent: IntentType;
  /** Student name — only present for ATTENDANCE intent */
  studentName?: string;
  /** Class identifier e.g. "8B", "7A" */
  className?: string;
  /** Subject e.g. "Math", "Science" */
  subject?: string;
  /** ISO date string e.g. "2026-04-25" */
  date?: string;
  /** Formatted notification message ready to send to parents */
  parentMessage: string;
  /** Confidence level of the extraction */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Twilio incoming webhook payload (simplified)
 */
export interface TwilioWebhookBody {
  MessageSid: string;
  From: string;   // e.g. "whatsapp:+919876543210"
  To: string;
  Body: string;
  NumMedia?: string;
}

/**
 * Result of a broadcast operation
 */
export interface BroadcastResult {
  success: boolean;
  recipientCount: number;
  failedCount: number;
  notificationId: string;
}

/**
 * Result of an attendance alert operation
 */
export interface AttendanceResult {
  success: boolean;
  studentName: string;
  parentName: string;
  parentPhone: string;
  notificationId: string;
  error?: string;
}