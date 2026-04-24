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
 * List students with pagination, search, filtering, and sorting.
 *
 * Query params:
 *   page      - page number (default 1)
 *   limit     - rows per page (default 50, max 200)
 *   search    - search student name, parent name, or roll number
 *   classId   - filter by class ID
 *   optedIn   - filter by parent opt-in (true/false)
 *   sortBy    - name | rollNumber | grade | parentName | optedIn (default: name)
 *   sortOrder - asc | desc (default: asc)
 */
router.get('/students', async (req: Request, res: Response) => {
  try {
    const {
      page: pageStr,
      limit: limitStr,
      search,
      classId,
      optedIn,
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query as Record<string, string | undefined>;

    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(limitStr || '50', 10) || 50));
    const skip = (page - 1) * limit;
    const order = sortOrder === 'desc' ? 'desc' : 'asc';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { rollNumber: { contains: q, mode: 'insensitive' } },
        { parent: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (classId) {
      where.classId = classId;
    }

    if (optedIn !== undefined) {
      where.parent = { ...(where.parent as object || {}), optedIn: optedIn === 'true' };
    }

    // Build orderBy clause
    let orderBy: unknown;
    switch (sortBy) {
      case 'rollNumber':
        orderBy = { rollNumber: order };
        break;
      case 'grade':
        orderBy = [{ class: { grade: order } }, { class: { section: order } }];
        break;
      case 'parentName':
        orderBy = { parent: { name: order } };
        break;
      case 'optedIn':
        orderBy = { parent: { optedIn: order } };
        break;
      case 'name':
      default:
        orderBy = { name: order };
        break;
    }

    // Run count + data queries in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findArgs: any = {
      where,
      include: {
        class: { select: { id: true, grade: true, section: true } },
        parent: {
          select: {
            id: true, name: true, phone: true,
            optedIn: true, languagePreference: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    };

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany(findArgs),
    ]);

    res.json({
      success: true,
      data: students,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[Admin] GET /students error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
});

/**
 * GET /api/students/:id
 * Single student with class & parent info
 */
router.get('/students/:id', async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id as string },
      include: {
        class: { select: { id: true, grade: true, section: true } },
        parent: true,
      },
    });
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }
    res.json({ success: true, data: student });
  } catch (err) {
    console.error('[Admin] GET /students/:id error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch student' });
  }
});

/**
 * PATCH /api/students/:id
 * Update student fields and/or parent fields
 */
router.patch('/students/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { studentName, rollNumber, classId, parentName, parentPhone, languagePreference } =
    req.body as {
      studentName?: string;
      rollNumber?: string;
      classId?: string;
      parentName?: string;
      parentPhone?: string;
      languagePreference?: 'EN' | 'HI' | 'PA';
    };

  try {
    const student = await prisma.student.update({
      where: { id },
      data: {
        ...(studentName && { name: studentName }),
        ...(rollNumber !== undefined && { rollNumber: rollNumber || null }),
        ...(classId && { classId }),
        ...(parentName || parentPhone || languagePreference
          ? {
              parent: {
                update: {
                  ...(parentName && { name: parentName }),
                  ...(parentPhone && { phone: parentPhone }),
                  ...(languagePreference && { languagePreference }),
                },
              },
            }
          : {}),
      },
      include: {
        class: { select: { id: true, grade: true, section: true } },
        parent: true,
      },
    });
    res.json({ success: true, data: student });
  } catch (err: unknown) {
    const isNotFound =
      typeof err === 'object' && err !== null && 'code' in err &&
      (err as { code: string }).code === 'P2025';
    if (isNotFound) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }
    console.error('[Admin] PATCH /students/:id error:', err);
    res.status(500).json({ success: false, error: 'Failed to update student' });
  }
});

/**
 * DELETE /api/students/:id
 * Delete student + parent + all related data (messageLogs, attendanceLogs)
 * Notifications are NOT deleted — they are class-level records.
 */
router.delete('/students/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  try {
    // Verify student exists and get parent id
    const student = await prisma.student.findUnique({
      where: { id },
      include: { parent: { select: { id: true } } },
    });

    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    // Delete in order to respect foreign key constraints:
    // 1. MessageLogs (FK → Parent)
    if (student.parent) {
      await prisma.messageLog.deleteMany({ where: { parentId: student.parent.id } });
    }

    // 2. AttendanceLogs (FK → Student)
    await prisma.attendanceLog.deleteMany({ where: { studentId: id } });

    // 3. Parent (FK → Student)
    if (student.parent) {
      await prisma.parent.delete({ where: { id: student.parent.id } });
    }

    // 4. Student
    await prisma.student.delete({ where: { id } });

    console.log(`[Admin] Deleted student ${id} (${student.name}) and all related data`);
    res.json({ success: true, data: { id, name: student.name } });
  } catch (err) {
    console.error('[Admin] DELETE /students/:id error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete student' });
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
// PARENTS
// ─────────────────────────────────────────────

/**
 * GET /api/parents
 * List all parents with opt-in status and language preference
 */
router.get('/parents', async (req: Request, res: Response) => {
  const { schoolId, classId, optedIn } = req.query as {
    schoolId?: string;
    classId?: string;
    optedIn?: string;
  };

  try {
    const parents = await prisma.parent.findMany({
      where: {
        ...(optedIn !== undefined && { optedIn: optedIn === 'true' }),
        student: {
          ...(classId && { classId }),
          ...(schoolId && { class: { schoolId } }),
        },
      },
      include: {
        student: {
          include: {
            class: { select: { grade: true, section: true, schoolId: true } },
          },
        },
      },
      orderBy: { student: { name: 'asc' } },
    });
    res.json({ success: true, data: parents });
  } catch (err) {
    console.error('[Admin] GET /parents error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch parents' });
  }
});

/**
 * PATCH /api/parents/:id
 * Update a parent's opt-in status and/or language preference.
 *
 * Body (all fields optional):
 *   { optedIn?: boolean, languagePreference?: 'EN' | 'HI' | 'PA' }
 */
router.patch('/parents/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { optedIn, languagePreference } = req.body as {
    optedIn?: boolean;
    languagePreference?: 'EN' | 'HI' | 'PA';
  };

  if (optedIn === undefined && languagePreference === undefined) {
    res.status(400).json({
      success: false,
      error: 'Provide at least one field to update: optedIn or languagePreference',
    });
    return;
  }

  const VALID_LANGUAGES = ['EN', 'HI', 'PA'];
  if (languagePreference !== undefined && !VALID_LANGUAGES.includes(languagePreference)) {
    res.status(400).json({
      success: false,
      error: `Invalid languagePreference. Must be one of: ${VALID_LANGUAGES.join(', ')}`,
    });
    return;
  }

  try {
    const parent = await prisma.parent.update({
      where: { id },
      data: {
        ...(optedIn !== undefined && { optedIn }),
        ...(languagePreference !== undefined && { languagePreference }),
      },
      include: {
        student: { select: { name: true } },
      },
    });

    console.log(
      `[Admin] Parent ${parent.id} (${parent.name}) updated — ` +
        `optedIn: ${parent.optedIn}, language: ${parent.languagePreference}`
    );

    res.json({ success: true, data: parent });
  } catch (err: unknown) {
    const isNotFound =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2025';

    if (isNotFound) {
      res.status(404).json({ success: false, error: 'Parent not found' });
      return;
    }
    console.error('[Admin] PATCH /parents/:id error:', err);
    res.status(500).json({ success: false, error: 'Failed to update parent' });
  }
});

/**
 * POST /api/parents/:id/opt-in
 * Convenience endpoint: opt a parent IN and optionally set language.
 */
router.post('/parents/:id/opt-in', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { languagePreference } = req.body as { languagePreference?: 'EN' | 'HI' | 'PA' };

  const VALID_LANGUAGES = ['EN', 'HI', 'PA'];
  if (languagePreference !== undefined && !VALID_LANGUAGES.includes(languagePreference)) {
    res.status(400).json({
      success: false,
      error: `Invalid languagePreference. Must be one of: ${VALID_LANGUAGES.join(', ')}`,
    });
    return;
  }

  try {
    const parent = await prisma.parent.update({
      where: { id },
      data: {
        optedIn: true,
        ...(languagePreference && { languagePreference }),
      },
      include: { student: { select: { name: true } } },
    });

    res.json({ success: true, data: parent });
  } catch (err: unknown) {
    const isNotFound =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2025';

    if (isNotFound) {
      res.status(404).json({ success: false, error: 'Parent not found' });
      return;
    }
    console.error('[Admin] POST /parents/:id/opt-in error:', err);
    res.status(500).json({ success: false, error: 'Failed to opt in parent' });
  }
});

/**
 * POST /api/parents/:id/opt-out
 * Convenience endpoint: opt a parent OUT.
 */
router.post('/parents/:id/opt-out', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  try {
    const parent = await prisma.parent.update({
      where: { id },
      data: { optedIn: false },
      include: { student: { select: { name: true } } },
    });

    res.json({ success: true, data: parent });
  } catch (err: unknown) {
    const isNotFound =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2025';

    if (isNotFound) {
      res.status(404).json({ success: false, error: 'Parent not found' });
      return;
    }
    console.error('[Admin] POST /parents/:id/opt-out error:', err);
    res.status(500).json({ success: false, error: 'Failed to opt out parent' });
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
// ANALYTICS
// ─────────────────────────────────────────────

/**
 * GET /api/analytics
 * Teacher engagement analytics:
 *   - Per-teacher: notification counts by type, recipients reached, attendance marked, last active
 *   - Overview: notification type breakdown, delivery stats
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    // Optional period filter
    const { period } = req.query as { period?: string };
    let startDate: Date | undefined;
    const now = new Date();
    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // start of today
    } else if (period === '7d') {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30d') {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === '90d') {
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    } else if (period === '180d') {
      startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
    }
    const dateFilter = startDate ? { gte: startDate } : undefined;

    // Fetch all teachers with their notifications and attendance logs
    const [teachers, deliveryStats, overviewByType] = await Promise.all([
      prisma.teacher.findMany({
        include: {
          school: { select: { name: true } },
          notifications: {
            select: {
              type: true,
              recipientCount: true,
              status: true,
              sentAt: true,
              createdAt: true,
            },
            ...(dateFilter && { where: { createdAt: dateFilter } }),
          },
          attendanceLogs: {
            select: { id: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            ...(dateFilter && { where: { createdAt: dateFilter } }),
          },
        },
        orderBy: { name: 'asc' },
      }),

      // Delivery stats across all message logs
      prisma.messageLog.groupBy({
        by: ['status'],
        _count: { id: true },
        ...(dateFilter && { where: { createdAt: dateFilter } }),
      }),

      // Notification counts by type (school-wide)
      prisma.notification.groupBy({
        by: ['type'],
        _count: { id: true },
        _sum: { recipientCount: true },
        ...(dateFilter && { where: { createdAt: dateFilter } }),
      }),
    ]);

    // Build per-teacher stats
    const teacherStats = teachers.map((t) => {
      const byType: Record<string, number> = {};
      let totalRecipients = 0;
      let lastActive: string | null = null;

      for (const n of t.notifications) {
        byType[n.type] = (byType[n.type] || 0) + 1;
        totalRecipients += n.recipientCount || 0;
        const d = (n.sentAt || n.createdAt).toISOString();
        if (!lastActive || d > lastActive) lastActive = d;
      }

      // Also check attendance logs for last active
      if (t.attendanceLogs[0]) {
        const d = t.attendanceLogs[0].createdAt.toISOString();
        if (!lastActive || d > lastActive) lastActive = d;
      }

      return {
        id: t.id,
        name: t.name,
        phone: t.phone,
        subject: t.subject,
        school: t.school,
        totalNotifications: t.notifications.length,
        totalAttendanceMarked: t.attendanceLogs.length,
        totalRecipients,
        byType,
        lastActive,
      };
    });

    // Build overview
    const overviewTypes: Record<string, { count: number; recipients: number }> = {};
    for (const row of overviewByType) {
      overviewTypes[row.type] = {
        count: row._count.id,
        recipients: row._sum.recipientCount || 0,
      };
    }

    const delivery: Record<string, number> = {};
    let totalDelivered = 0;
    let totalMessages = 0;
    for (const row of deliveryStats) {
      delivery[row.status] = row._count.id;
      totalMessages += row._count.id;
      if (row.status === 'DELIVERED') totalDelivered = row._count.id;
    }

    res.json({
      success: true,
      data: {
        teachers: teacherStats,
        overview: {
          byType: overviewTypes,
          delivery,
          deliveryRate: totalMessages > 0 ? Math.round((totalDelivered / totalMessages) * 100) : 0,
          totalMessages,
        },
      },
    });
  } catch (err) {
    console.error('[Admin] GET /analytics error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
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