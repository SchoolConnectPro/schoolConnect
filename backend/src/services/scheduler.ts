import cron from 'node-cron';
import { broadcastToClass } from './broadcast';
import prisma from '../lib/prisma';

/**
 * Start the notification scheduler.
 * Runs every minute and sends any PENDING notifications whose scheduledAt time has passed.
 */
export function startScheduler(): void {
  console.log('[Scheduler] Starting notification scheduler...');

  // Run every 5 minutes (reduces DB connection pressure on free tier)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const pending = await prisma.notification.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: { lte: new Date() },
        },
        include: {
          targetClass: true,
          createdByTeacher: true,
        },
      });

      if (pending.length === 0) return;

      console.log(`[Scheduler] Processing ${pending.length} pending notification(s)...`);

      for (const notification of pending) {
        try {
          const classIdentifier = notification.targetClass
            ? `${notification.targetClass.grade}${notification.targetClass.section}`
            : null;

          await broadcastToClass(
            classIdentifier,
            notification.schoolId,
            notification.message,
            notification.type,
            notification.rawTeacherMessage || '',
            notification.createdByTeacherId || ''
          );

          console.log(`[Scheduler] Sent notification ${notification.id}`);
        } catch (err) {
          console.error(`[Scheduler] Failed to send notification ${notification.id}:`, err);

          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'FAILED' },
          });
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error in cron job:', err);
    }
  });

  console.log('[Scheduler] ✅ Scheduler running — checking every minute');
}