import { NotificationType } from '@prisma/client';
import { sendWhatsApp } from '../lib/twilio';
import { BroadcastResult } from '../types';
import { getLocalizedMessage } from './translation';
import prisma from '../lib/prisma';

/**
 * Broadcast a notification to all opted-in parents in a class (or school-wide).
 *
 * @param classIdentifier - e.g. "8B", "7A", or null for school-wide
 * @param schoolId - School ID
 * @param message - Formatted message text to send to parents
 * @param type - Notification type
 * @param rawTeacherMessage - Original teacher message (for audit)
 * @param teacherId - Teacher who triggered this
 */
export async function broadcastToClass(
  classIdentifier: string | null,
  schoolId: string,
  message: string,
  type: NotificationType,
  rawTeacherMessage: string,
  teacherId: string
): Promise<BroadcastResult> {
  // ── 1. Resolve class ID ─────────────────────────────────────────────────
  let targetClassId: string | null = null;

  if (classIdentifier) {
    const { grade, section } = parseClassIdentifier(classIdentifier);

    const cls = await prisma.class.findFirst({
      where: { grade, section, schoolId },
    });

    if (!cls) {
      console.error(`[Broadcast] Class not found: ${classIdentifier} in school ${schoolId}`);
      return { success: false, recipientCount: 0, failedCount: 0, notificationId: '' };
    }

    targetClassId = cls.id;
  }

  // ── 2. Create Notification record ───────────────────────────────────────
  const notification = await prisma.notification.create({
    data: {
      type,
      rawTeacherMessage,
      message,
      targetClassId,
      schoolId,
      createdByTeacherId: teacherId,
      status: 'PENDING',
    },
  });

  // ── 3. Fetch all opted-in parents ───────────────────────────────────────
  const parents = await prisma.parent.findMany({
    where: {
      optedIn: true,
      student: {
        class: targetClassId
          ? { id: targetClassId }
          : { schoolId }, // school-wide: all classes in this school
      },
    },
    include: {
      student: {
        include: { class: true },
      },
    },
  });

  if (parents.length === 0) {
    console.log(`[Broadcast] ℹ️  No opted-in parents found for ${classIdentifier ?? 'school-wide'} — nothing to send`);
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', sentAt: new Date(), recipientCount: 0 },
    });
    return { success: true, recipientCount: 0, failedCount: 0, notificationId: notification.id };
  }

  // Language breakdown for logging
  const langCounts = parents.reduce<Record<string, number>>((acc, p) => {
    acc[p.languagePreference] = (acc[p.languagePreference] || 0) + 1;
    return acc;
  }, {});
  console.log(`[Broadcast] 📤 Sending to ${parents.length} parent(s) | Languages: ${JSON.stringify(langCounts)} | Type: ${type}`);

  // ── 4. Send WhatsApp to each parent (with per-language translation) ──────
  let successCount = 0;
  let failedCount = 0;

  // Shared translation cache for this broadcast batch.
  // Claude is called at most once per non-English language.
  const translationCache = new Map<string, string>();

  const sendPromises = parents.map(async (parent) => {
    try {
      const lang = parent.languagePreference as 'EN' | 'HI' | 'PA';
      const localizedMessage = await getLocalizedMessage(message, lang, translationCache);
      const sid = await sendWhatsApp(parent.phone, localizedMessage);

      await prisma.messageLog.create({
        data: {
          notificationId: notification.id,
          parentId: parent.id,
          twilioMessageSid: sid,
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      console.log(`[Broadcast]    ✅ Sent to ${parent.name} (${parent.phone}) [${lang}] | SID: ${sid}`);
      successCount++;
    } catch (err) {
      console.error(`[Broadcast]    ❌ Failed to send to ${parent.name} (${parent.phone}):`, err);

      await prisma.messageLog.create({
        data: {
          notificationId: notification.id,
          parentId: parent.id,
          status: 'FAILED',
        },
      });

      failedCount++;
    }
  });

  await Promise.allSettled(sendPromises);

  // ── 5. Update Notification status ───────────────────────────────────────
  const finalStatus = failedCount === parents.length ? 'FAILED' : 'SENT';
  console.log(`[Broadcast] 📊 Result: ${successCount} sent, ${failedCount} failed | Status: ${finalStatus} | NotificationID: ${notification.id}`);

  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: finalStatus,
      sentAt: new Date(),
      recipientCount: successCount,
    },
  });

  return {
    success: true,
    recipientCount: successCount,
    failedCount,
    notificationId: notification.id,
  };
}

/**
 * Parse a class identifier like "8B" or "8 B" into grade and section.
 */
export function parseClassIdentifier(identifier: string): { grade: string; section: string } {
  const cleaned = identifier.trim().toUpperCase().replace(/\s+/g, '');

  // Match patterns like "8B", "10A", "KGA"
  const match = cleaned.match(/^(\d+|[A-Z]+)([A-Z]+)$/);
  if (match) {
    return { grade: match[1], section: match[2] };
  }

  // Fallback: last character is section, rest is grade
  const section = cleaned.slice(-1);
  const grade = cleaned.slice(0, -1);
  return { grade, section };
}