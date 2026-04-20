import Anthropic from '@anthropic-ai/sdk';
import { ParsedTeacherMessage } from '../types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-5';

// ─────────────────────────────────────────────
// System prompt for the Teacher Message Agent
// ─────────────────────────────────────────────
const TEACHER_AGENT_SYSTEM_PROMPT = `You are SchoolConnect's AI assistant for a school communication platform in India.

Your job is to parse natural WhatsApp messages sent by teachers and extract structured information.

You must return ONLY a valid JSON object — no explanation, no markdown, no code fences.

The JSON must have this exact structure:
{
  "intent": "ATTENDANCE" | "BROADCAST" | "TEST_REMINDER" | "EVENT" | "HOMEWORK" | "EMERGENCY" | "UNKNOWN",
  "studentName": "string or null",
  "className": "string or null (e.g. '8B', '7A')",
  "subject": "string or null (e.g. 'Math', 'Science')",
  "date": "string or null (ISO format YYYY-MM-DD if a date is mentioned)",
  "parentMessage": "string (formatted WhatsApp notification for parents — professional, warm, under 150 words)",
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}

Intent classification rules:
- ATTENDANCE: teacher is marking a student absent (e.g. "Diksha absent", "Rahul nahi aaya", "mark Priya absent 8B")
- TEST_REMINDER: upcoming test or exam (e.g. "math test friday", "unit test chapters 4-5")
- EVENT: school event (e.g. "sports day", "annual function", "PTM")
- HOMEWORK: homework assignment (e.g. "science homework chapters 3-4 due thursday")
- EMERGENCY: urgent school-wide message (e.g. "school closed tomorrow", "emergency")
- BROADCAST: general announcement that doesn't fit above categories
- UNKNOWN: cannot determine intent with confidence

For ATTENDANCE intent:
- Extract the student's name carefully
- parentMessage should be a warm, professional absence notification

For TEST_REMINDER intent:
- parentMessage should include subject, date, and topics if mentioned
- Add a reminder to help the child prepare

For parentMessage formatting:
- Start with a relevant emoji
- Include school context
- Keep it under 150 words
- Professional but warm tone
- Do NOT include the school name (it will be added dynamically)
- Write in English

Today's date is: ${new Date().toISOString().split('T')[0]}`;

// ─────────────────────────────────────────────
// Parse a teacher's WhatsApp message
// ─────────────────────────────────────────────
export async function parseTeacherMessage(
  messageText: string,
  schoolName: string
): Promise<ParsedTeacherMessage> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: TEACHER_AGENT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `School: ${schoolName}\nTeacher message: "${messageText}"`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Strip any accidental markdown code fences
  const rawText = content.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');

  const parsed = JSON.parse(rawText) as ParsedTeacherMessage;
  return parsed;
}

// ─────────────────────────────────────────────
// Format a parent notification message
// ─────────────────────────────────────────────
export async function formatParentNotification(
  rawMessage: string,
  schoolName: string,
  className: string
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Format this school notification for WhatsApp. School: ${schoolName}, Class: ${className}.
Make it professional, warm, under 100 words. Start with a relevant emoji. Return only the formatted message text.

Raw message: "${rawMessage}"`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return content.text.trim();
}