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
  "studentNames": ["string"] or [],
  "className": "string or null (e.g. '8B', '7A')",
  "subject": "string or null (e.g. 'Math', 'Science')",
  "date": "string or null (ISO format YYYY-MM-DD if a date is mentioned)",
  "parentMessage": "string (formatted WhatsApp notification for parents — professional, warm, under 150 words)",
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}

Intent classification rules:
- ATTENDANCE: teacher is marking one or more students absent (e.g. "Diksha absent", "Amit, Arsh, Harman absent 8B", "Rahul nahi aaya")
- TEST_REMINDER: upcoming test or exam (e.g. "math test friday", "unit test chapters 4-5")
- EVENT: school event (e.g. "sports day", "annual function", "PTM")
- HOMEWORK: homework assignment (e.g. "science homework chapters 3-4 due thursday")
- EMERGENCY: urgent school-wide message (e.g. "school closed tomorrow", "emergency")
- BROADCAST: general announcement that doesn't fit above categories
- UNKNOWN: cannot determine intent with confidence

For ATTENDANCE intent:
- Extract ALL student names into the studentNames array (e.g. ["Amit", "Arsh", "Harman"])
- For a single student, still use the array: ["Diksha"]
- studentNames should be empty [] for non-ATTENDANCE intents
- parentMessage should be a warm, professional absence notification for ONE student (use placeholder "{studentName}" — it will be replaced per student)

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
// Translate a parent notification to Hindi or Punjabi
// ─────────────────────────────────────────────
const LANGUAGE_NAMES: Record<string, string> = {
  HI: 'Hindi (Devanagari script)',
  PA: 'Punjabi (Gurmukhi script)',
};

export async function translateMessage(
  message: string,
  targetLanguage: 'HI' | 'PA'
): Promise<string> {
  const langName = LANGUAGE_NAMES[targetLanguage];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048, // Increased: Devanagari/Gurmukhi scripts use 2-3x more tokens than English
    system:
      `You are a professional translator for a school communication platform in India. ` +
      `Translate messages completely and accurately. Never truncate or summarize. ` +
      `Return ONLY the translated text — no explanations, no labels, no quotes.`,
    messages: [
      {
        role: 'user',
        content:
          `Translate the following WhatsApp school notification to ${langName}.\n` +
          `Rules:\n` +
          `- Translate the COMPLETE message — do not cut it short\n` +
          `- Keep all emojis exactly as they are\n` +
          `- Keep phone numbers, dates, and class names (e.g. "8B") unchanged\n` +
          `- Use natural, warm, parent-friendly language\n` +
          `- Return ONLY the translated text — no explanation, no quotes\n\n` +
          `Message:\n${message}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude during translation');
  }

  return content.text.trim();
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