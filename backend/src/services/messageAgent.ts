import { parseTeacherMessage } from '../lib/claude';
import { buildTwiMLResponse } from '../lib/twilio';
import { broadcastToClass } from './broadcast';
import { handleAbsence } from './attendance';
import { ParsedTeacherMessage } from '../types';
import prisma from '../lib/prisma';

/**
 * Main entry point for processing a teacher's incoming WhatsApp message.
 * Identifies the teacher, classifies intent via Claude, and routes to the
 * appropriate service (broadcast or attendance).
 *
 * @param fromPhone - Teacher's WhatsApp number e.g. "+919876543210"
 * @param messageBody - Raw text of the teacher's message
 * @returns TwiML XML string to send back to Twilio
 */
export async function processTeacherMessage(
  fromPhone: string,
  messageBody: string
): Promise<string> {
  // Normalize phone number (strip whatsapp: prefix if present)
  const phone = fromPhone.replace('whatsapp:', '');
  const body = messageBody.trim();

  // ── 1. Look up teacher ──────────────────────────────────────────────────
  const teacher = await prisma.teacher.findUnique({
    where: { phone },
    include: {
      school: true,
      classes: {
        include: { class: true },
      },
    },
  });

  if (!teacher) {
    console.log(`[MessageAgent] ⚠️  Unregistered number: ${phone} — not a teacher`);
    return buildTwiMLResponse(
      '❌ Your number is not registered in SchoolConnect. Please contact your school admin.'
    );
  }

  console.log(`[MessageAgent] 👩‍🏫 Teacher: ${teacher.name} (${phone}) | School: ${teacher.school.name}`);

  // ── 2. Handle simple commands ───────────────────────────────────────────
  const command = body.toUpperCase().trim();

  if (command === 'HELP') {
    return buildTwiMLResponse(
      `📋 *SchoolConnect Commands*\n\n` +
        `Just type naturally:\n` +
        `• "Diksha absent class 8B"\n` +
        `• "Math test 25 April chapters 4-5 grade 8B"\n` +
        `• "Sports Day on 30 April all classes"\n\n` +
        `Commands:\n` +
        `• STATUS — last 3 sent messages\n` +
        `• HELP — this message`
    );
  }

  if (command === 'STATUS') {
    const recent = await prisma.notification.findMany({
      where: { createdByTeacherId: teacher.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { targetClass: true },
    });

    if (recent.length === 0) {
      return buildTwiMLResponse('📭 No messages sent yet.');
    }

    const lines = recent.map((n, i) => {
      const cls = n.targetClass ? `Class ${n.targetClass.grade}${n.targetClass.section}` : 'All classes';
      const date = n.sentAt ? n.sentAt.toLocaleDateString('en-IN') : 'Pending';
      return `${i + 1}. ${n.type} → ${cls} | ${n.recipientCount} parents | ${date}`;
    });

    return buildTwiMLResponse(`📊 *Recent Messages:*\n\n${lines.join('\n')}`);
  }

  // ── 3. Parse message with Claude ────────────────────────────────────────
  let parsed: ParsedTeacherMessage;

  console.log(`[MessageAgent] 🤖 Sending to Claude | School: ${teacher.school.name} | Message: "${body}"`);

  try {
    parsed = await parseTeacherMessage(body, teacher.school.name);
    const namesLog = parsed.studentNames?.join(', ') || parsed.studentName || 'N/A';
    console.log(`[MessageAgent] 🤖 Claude → intent: ${parsed.intent} | confidence: ${parsed.confidence} | students: [${namesLog}] | class: ${parsed.className ?? 'N/A'}`);
  } catch (err) {
    console.error('[MessageAgent] ❌ Claude parsing error:', err);
    return buildTwiMLResponse(
      '⚠️ Sorry, I could not understand that message. Please try again or type HELP for examples.'
    );
  }

  // ── 4. Handle LOW confidence ────────────────────────────────────────────
  if (parsed.intent === 'UNKNOWN' || parsed.confidence === 'LOW') {
    console.log(`[MessageAgent] Low confidence / unknown intent — returning clarification`);
    return buildTwiMLResponse(
      `🤔 I'm not sure I understood that correctly.\n\n` +
        `Did you mean to:\n` +
        `• Mark a student absent? (e.g. "Diksha absent 8B")\n` +
        `• Send a class notification? (e.g. "Math test Friday 8B")\n\n` +
        `Type HELP for more examples.`
    );
  }

  // ── 5. Route to appropriate service ────────────────────────────────────
  console.log(`[MessageAgent] Routing intent: ${parsed.intent}`);

  try {
    if (parsed.intent === 'ATTENDANCE') {
      // Resolve student names — support both new (studentNames[]) and legacy (studentName)
      const rawNames: string[] =
        parsed.studentNames && parsed.studentNames.length > 0
          ? parsed.studentNames
          : parsed.studentName
            ? [parsed.studentName]
            : [];

      console.log(`[MessageAgent] ATTENDANCE — students: [${rawNames.join(', ')}], class: "${parsed.className}"`);

      if (rawNames.length === 0) {
        return buildTwiMLResponse(
          "❌ I couldn't find any student names in your message. Please include the student's name, e.g. 'Diksha absent class 8B'"
        );
      }

      // Determine class — from message or teacher's assigned classes
      const classIdentifier = parsed.className || getTeacherDefaultClass(teacher);
      console.log(`[MessageAgent] Using class identifier: "${classIdentifier}"`);

      if (!classIdentifier) {
        return buildTwiMLResponse(
          '❌ Please include the class, e.g. "Diksha absent class 8B"'
        );
      }

      // ── Process all students in parallel ─────────────────────────────
      const baseMessage = parsed.parentMessage;

      const results = await Promise.allSettled(
        rawNames.map((name) => {
          // Replace {studentName} placeholder if Claude used it, otherwise use as-is
          const personalizedMessage = baseMessage.includes('{studentName}')
            ? baseMessage.replace(/\{studentName\}/g, name)
            : baseMessage;

          console.log(`[MessageAgent] → handleAbsence: "${name}" | class: "${classIdentifier}"`);
          return handleAbsence(name, classIdentifier, teacher.id, teacher.school.id, personalizedMessage);
        })
      );

      // ── Build summary reply for teacher ──────────────────────────────
      const sent: string[] = [];
      const failed: string[] = [];

      results.forEach((r, i) => {
        const name = rawNames[i];
        if (r.status === 'fulfilled' && r.value.success) {
          sent.push(`${r.value.studentName} → ${r.value.parentName}`);
        } else {
          const errMsg = r.status === 'fulfilled' ? r.value.error : String(r.reason);
          failed.push(`${name}: ${errMsg}`);
          console.warn(`[MessageAgent] ⚠️  Failed for "${name}": ${errMsg}`);
        }
      });

      console.log(`[MessageAgent] Bulk attendance done — sent: ${sent.length}, failed: ${failed.length}`);

      let reply = `✅ *Attendance Recorded*\n\n`;

      if (sent.length > 0) {
        reply += `📤 *Notified (${sent.length}):*\n`;
        sent.forEach((s) => (reply += `• ${s}\n`));
      }

      if (failed.length > 0) {
        reply += `\n⚠️ *Could not notify (${failed.length}):*\n`;
        failed.forEach((f) => (reply += `• ${f}\n`));
      }

      return buildTwiMLResponse(reply.trim());
    }

    // BROADCAST / TEST_REMINDER / EVENT / HOMEWORK / EMERGENCY
    if (!parsed.className && parsed.intent !== 'EMERGENCY') {
      // Try to infer class from teacher's assignments
      const defaultClass = getTeacherDefaultClass(teacher);
      if (!defaultClass) {
        return buildTwiMLResponse(
          '❌ Please include the class in your message, e.g. "Math test Friday *grade 8B*"'
        );
      }
      parsed.className = defaultClass;
    }

    console.log(`[MessageAgent] Broadcasting to class: "${parsed.className}" — ${parsed.intent}`);

    const result = await broadcastToClass(
      parsed.className || null,
      teacher.school.id,
      parsed.parentMessage,
      parsed.intent,
      body,
      teacher.id
    );

    console.log(`[MessageAgent] broadcastToClass result:`, JSON.stringify(result, null, 2));

    if (!result.success) {
      return buildTwiMLResponse('❌ Failed to send notification. Please try again.');
    }

    const classLabel = parsed.className ? `Class ${parsed.className}` : 'All classes';
    return buildTwiMLResponse(
      `✅ *Sent Successfully*\n\n` +
        `📤 ${classLabel}\n` +
        `👨‍👩‍👦 ${result.recipientCount} parents notified\n` +
        `${result.failedCount > 0 ? `⚠️ ${result.failedCount} failed\n` : ''}` +
        `🕐 ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
    );
  } catch (err) {
    console.error('[MessageAgent] ❌ Service error:', err);
    return buildTwiMLResponse(
      '⚠️ Something went wrong while sending the notification. Please try again.'
    );
  }
}

/**
 * Returns the first class identifier assigned to a teacher, or null.
 */
function getTeacherDefaultClass(teacher: {
  classes: Array<{ class: { grade: string; section: string } }>;
}): string | null {
  if (teacher.classes.length === 0) return null;
  const c = teacher.classes[0].class;
  return `${c.grade}${c.section}`;
}