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
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', sentAt: new Date(), recipientCount: 0 },
    });
    return { success: true, recipientCount: 0, failedCount: 0, notificationId: notification.id };
  }

  // ── 4. Send WhatsApp to each parent (with per-language translation) ──────
  let successCount = 0;
  let failedCount = 0;

  // Shared translation cache for this broadcast batch.
  // Claude is called at most once per non-English language (e.g. one call for
  // all Hindi-preferring parents, one call for all Punjabi-preferring parents).
  const translationCache = new Map<string, string>();

  const sendPromises = parents.map(async (parent) => {
    try {
      // Translate the message to this parent's preferred language
      const localizedMessage = await getLocalizedMessage(
        message,
        parent.languagePreference as 'EN' | 'HI' | 'PA',
        translationCache
      );

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

      successCount++;
    } catch (err) {
      console.error(`[Broadcast] Failed to send to parent ${parent.id}:`, err);

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
  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: failedCount === parents.length ? 'FAILED' : 'SENT',
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