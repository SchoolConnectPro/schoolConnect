import { Router, Request, Response } from 'express';
import { sendWhatsApp } from '../lib/twilio';
import prisma from '../lib/prisma';

const router = Router();

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────

/**
 * GET /api/notifications
 * List all notifications (most recent first)
 */
router.get('/notifications', async (_req: Request, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        targetClass: true,
        createdByTeacher: { select: { name: true, phone: true } },
        _count: { select: { messageLogs: true } },
      },
    });
    res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('[Admin] GET /notifications error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/:id
 * Single notification with delivery stats
 */
router.get('/notifications/:id', async (req: Request, res: Response) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id as string },
      include: {
        targetClass: true,
        createdByTeacher: { select: { name: true } },
        messageLogs: {
          include: {
            parent: { select: { name: true, phone: true } },
          },
        },
      },
    });

    if (!notification) {
      res.status(404).json({ success: false, error: 'Notification not found' });
      return;
    }

    res.json({ success: true, data: notification });
  } catch (err) {
    console.error('[Admin] GET /notifications/:id error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch notification' });
  }
});

// ─────────────────────────────────────────────
// CLASSES
// ─────────────────────────────────────────────

/**
 * GET /api/classes
 * List all classes
 */
router.get('/classes', async (_req: Request, res: Response) => {
  try {
    const classes = await prisma.class.findMany({
      include: {
        _count: { select: { students: true } },
        school: { select: { name: true } },
      },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }],
    });
    res.json({ success: true, data: classes });
  } catch (err) {
    console.error('[Admin] GET /classes error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch classes' });
  }
});

/**
 * GET /api/classes/:id/parents
 * All parents in a class
 */
router.get('/classes/:id/parents', async (req: Request, res: Response) => {
  try {
    const parents = await prisma.parent.findMany({
      where: { student: { classId: req.params.id as string } },
      include: {
        student: { select: { name: true, rollNumber: true } },
      },
      orderBy: { student: { name: 'asc' } },
    });
    res.json({ success: true, data: parents });
  } catch (err) {
    console.error('[Admin] GET /classes/:id/parents error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch parents' });
  }
});

// ─────────────────────────────────────────────
// STUDENTS
// ─────────────────────────────────────────────

/**
 * GET /api/students
 * List all students
 */
router.get('/students', async (_req: Request, res: Response) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        class: { select: { grade: true, section: true } },
        parent: { select: { name: true, phone: true, optedIn: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: students });
  } catch (err) {
    console.error('[Admin] GET /students error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
});

/**
 * POST /api/students
 * Add a student + parent
 */
router.post('/students', async (req: Request, res: Response) => {
  const { studentName, rollNumber, classId, parentName, parentPhone, languagePreference } =
    req.body as {
      studentName: string;
      rollNumber?: string;
      classId: string;
      parentName: string;
      parentPhone: string;
      languagePreference?: 'EN' | 'HI' | 'PA';
    };

  if (!studentName || !classId || !parentName || !parentPhone) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }

  try {
    const student = await prisma.student.create({
      data: {
        name: studentName,
        rollNumber,
        classId,
        parent: {
          create: {
            name: parentName,
            phone: parentPhone,
            languagePreference: languagePreference || 'EN',
            optedIn: true,
          },
        },
      },
      include: { parent: true, class: true },
    });

    res.status(201).json({ success: true, data: student });
  } catch (err) {
    console.error('[Admin] POST /students error:', err);
    res.status(500).json({ success: false, error: 'Failed to create student' });
  }
});

// ─────────────────────────────────────────────
// TEACHERS
// ─────────────────────────────────────────────

/**
 * GET /api/teachers
 * List all teachers
 */
router.get('/teachers', async (_req: Request, res: Response) => {
  try {
    const teachers = await prisma.teacher.findMany({
      include: {
        school: { select: { name: true } },
        classes: {
          include: { class: { select: { grade: true, section: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: teachers });
  } catch (err) {
    console.error('[Admin] GET /teachers error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch teachers' });
  }
});

/**
 * POST /api/teachers
 * Register a new teacher
 */
router.post('/teachers', async (req: Request, res: Response) => {
  const { name, phone, subject, schoolId, classIds } = req.body as {
    name: string;
    phone: string;
    subject?: string;
    schoolId: string;
    classIds?: string[];
  };

  if (!name || !phone || !schoolId) {
    res.status(400).json({ success: false, error: 'Missing required fields: name, phone, schoolId' });
    return;
  }

  try {
    const teacher = await prisma.teacher.create({
      data: {
        name,
        phone,
        subject,
        schoolId,
        classes: classIds
          ? {
              create: classIds.map((classId) => ({ classId })),
            }
          : undefined,
      },
      include: {
        classes: { include: { class: true } },
      },
    });

    res.status(201).json({ success: true, data: teacher });
  } catch (err) {
    console.error('[Admin] POST /teachers error:', err);
    res.status(500).json({ success: false, error: 'Failed to create teacher' });
  }
});

// ─────────────────────────────────────────────
// TEST MESSAGE
// ─────────────────────────────────────────────

/**
 * POST /api/test-message
 * Send a test WhatsApp message to a specific number (for demo purposes)
 */
router.post('/test-message', async (req: Request, res: Response) => {
  const { phone, message } = req.body as { phone: string; message: string };

  if (!phone || !message) {
    res.status(400).json({ success: false, error: 'Missing phone or message' });
    return;
  }

  try {
    const sid = await sendWhatsApp(phone, message);
    res.json({ success: true, messageSid: sid });
  } catch (err) {
    console.error('[Admin] POST /test-message error:', err);
    res.status(500).json({ success: false, error: 'Failed to send test message' });
  }
});

// ─────────────────────────────────────────────
// ATTENDANCE LOGS
// ─────────────────────────────────────────────

/**
 * GET /api/attendance
 * Recent attendance logs
 */
router.get('/attendance', async (_req: Request, res: Response) => {
  try {
    const logs = await prisma.attendanceLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        student: {
          include: {
            class: { select: { grade: true, section: true } },
            parent: { select: { name: true, phone: true } },
          },
        },
        markedByTeacher: { select: { name: true } },
      },
    });
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[Admin] GET /attendance error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance logs' });
  }
});

// ─────────────────────────────────────────────
// SCHOOLS
// ─────────────────────────────────────────────

/**
 * GET /api/schools
 */
router.get('/schools', async (_req: Request, res: Response) => {
  try {
    const schools = await prisma.school.findMany({
      include: {
        _count: { select: { teachers: true, classes: true } },
      },
    });
    res.json({ success: true, data: schools });
  } catch (err) {
    console.error('[Admin] GET /schools error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch schools' });
  }
});

export default router;