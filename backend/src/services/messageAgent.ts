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
    return buildTwiMLResponse(
      '❌ Your number is not registered in SchoolConnect. Please contact your school admin.'
    );
  }

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

  console.log(`[MessageAgent] Sending to Claude — school: ${teacher.school.name}, message: "${body}"`);

  try {
    parsed = await parseTeacherMessage(body, teacher.school.name);
    console.log(`[MessageAgent] Claude result:`, JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error('[MessageAgent] Claude parsing error:', err);
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
      console.log(`[MessageAgent] ATTENDANCE — studentName: "${parsed.studentName}", class: "${parsed.className}"`);

      if (!parsed.studentName) {
        return buildTwiMLResponse(
          "❌ I couldn't find a student name in your message. Please include the student's name, e.g. 'Diksha absent class 8B'"
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

      console.log(`[MessageAgent] Calling handleAbsence — student: "${parsed.studentName}", class: "${classIdentifier}"`);

      const result = await handleAbsence(
        parsed.studentName,
        classIdentifier,
        teacher.id,
        teacher.school.id,
        parsed.parentMessage
      );

      console.log(`[MessageAgent] handleAbsence result:`, JSON.stringify(result, null, 2));

      if (!result.success) {
        return buildTwiMLResponse(`❌ ${result.error}`);
      }

      return buildTwiMLResponse(
        `✅ *Attendance Alert Sent*\n\n` +
          `Student: ${result.studentName}\n` +
          `Parent: ${result.parentName}\n` +
          `Message delivered to parent's WhatsApp.`
      );
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
    console.error('[MessageAgent] Service error:', err);
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