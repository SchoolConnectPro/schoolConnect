import { sendWhatsApp } from '../lib/twilio';
import { AttendanceResult } from '../types';
import { parseClassIdentifier } from './broadcast';
import { getLocalizedMessage } from './translation';
import prisma from '../lib/prisma';

/**
 * Handle a teacher marking a student absent via WhatsApp.
 * Finds the student by name + class (also searches by parent name),
 * notifies the parent, and logs the event.
 */
export async function handleAbsence(
  studentName: string,
  classIdentifier: string,
  teacherId: string,
  schoolId: string,
  parentMessage: string
): Promise<AttendanceResult> {
  const { grade, section } = parseClassIdentifier(classIdentifier);

  // ── 1. Find the class ───────────────────────────────────────────────────
  const cls = await prisma.class.findFirst({
    where: { grade, section, schoolId },
  });

  if (!cls) {
    return {
      success: false,
      studentName,
      parentName: '',
      parentPhone: '',
      notificationId: '',
      error: `Class ${classIdentifier} not found. Please check the class name.`,
    };
  }

  // ── 2. Find the student ─────────────────────────────────────────────────
  // Load all students in the class with their parents
  const students = await prisma.student.findMany({
    where: { classId: cls.id },
    include: { parent: true },
  });

  const normalizedInput = studentName.toLowerCase().trim();

  // Priority 1: exact student name match
  let student = students.find(
    (s) => s.name.toLowerCase() === normalizedInput
  );

  // Priority 2: partial student name match (first name)
  if (!student) {
    student = students.find((s) => {
      const sName = s.name.toLowerCase();
      const inputFirst = normalizedInput.split(' ')[0];
      return sName.includes(normalizedInput) || sName.startsWith(inputFirst);
    });
  }

  // Priority 3: match by PARENT name (teacher may say parent's name)
  if (!student) {
    student = students.find((s) => {
      if (!s.parent) return false;
      const pName = s.parent.name.toLowerCase();
      return pName === normalizedInput || pName.includes(normalizedInput) ||
        normalizedInput.includes(pName.split(' ')[0]);
    });
  }

  if (!student) {
    // Build a helpful list of student names for the teacher
    const nameList = students.map((s) => s.name).join(', ');
    return {
      success: false,
      studentName,
      parentName: '',
      parentPhone: '',
      notificationId: '',
      error: `Student "${studentName}" not found in Class ${grade}${section}.\nStudents in this class: ${nameList}`,
    };
  }

  if (!student.parent) {
    return {
      success: false,
      studentName: student.name,
      parentName: '',
      parentPhone: '',
      notificationId: '',
      error: `No parent registered for ${student.name}. Please contact the school admin.`,
    };
  }

  const parent = student.parent;

  // ── 3. Check if parent has opted in ────────────────────────────────────
  if (!parent.optedIn) {
    console.warn(`[Attendance] ⚠️  Parent ${parent.name} (${parent.phone}) has opted out — skipping notification for ${student.name}`);
    return {
      success: false,
      studentName: student.name,
      parentName: parent.name,
      parentPhone: parent.phone,
      notificationId: '',
      error: `Parent of ${student.name} has opted out of notifications. No message sent.`,
    };
  }

  console.log(`[Attendance] 📋 Processing absence: ${student.name} | Class ${grade}${section} | Parent: ${parent.name} (${parent.phone}) | Lang: ${parent.languagePreference}`);

  // ── 4. Create Notification record ───────────────────────────────────────
  const notification = await prisma.notification.create({
    data: {
      type: 'ATTENDANCE',
      rawTeacherMessage: `${studentName} absent ${classIdentifier}`,
      message: parentMessage,
      targetClassId: cls.id,
      schoolId,
      createdByTeacherId: teacherId,
      status: 'PENDING',
    },
  });

  // ── 5. Create AttendanceLog ─────────────────────────────────────────────
  const attendanceLog = await prisma.attendanceLog.create({
    data: {
      studentId: student.id,
      markedByTeacherId: teacherId,
      date: new Date(),
    },
  });

  // ── 6. Send WhatsApp to parent (in their preferred language) ───────────
  try {
    const lang = parent.languagePreference as 'EN' | 'HI' | 'PA';
    console.log(`[Attendance] 📤 Sending to ${parent.phone} in ${lang}…`);

    const localizedMessage = await getLocalizedMessage(parentMessage, lang);
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

    await prisma.attendanceLog.update({
      where: { id: attendanceLog.id },
      data: { parentNotifiedAt: new Date() },
    });

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', sentAt: new Date(), recipientCount: 1 },
    });

    console.log(`[Attendance] ✅ Notification sent | SID: ${sid} | Student: ${student.name} | Parent: ${parent.name}`);

    return {
      success: true,
      studentName: student.name,
      parentName: parent.name,
      parentPhone: parent.phone,
      notificationId: notification.id,
    };
  } catch (err) {
    console.error(`[Attendance] ❌ Failed to send WhatsApp to ${parent.name} (${parent.phone}):`, err);

    await prisma.messageLog.create({
      data: {
        notificationId: notification.id,
        parentId: parent.id,
        status: 'FAILED',
      },
    });

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'FAILED' },
    });

    return {
      success: false,
      studentName: student.name,
      parentName: parent.name,
      parentPhone: parent.phone,
      notificationId: notification.id,
      error: 'Failed to send WhatsApp message. Please try again.',
    };
  }
}

/**
 * Handle a parent's reply to an attendance alert (SICK / KNOWN / PRESENT).
 */
export async function handleParentAttendanceReply(
  parentPhone: string,
  replyText: string
): Promise<string | null> {
  const phone = parentPhone.replace('whatsapp:', '');
  const reply = replyText.trim().toUpperCase();

  if (!['SICK', 'KNOWN', 'PRESENT'].includes(reply)) {
    return null;
  }

  console.log(`[Attendance] 📩 Parent reply "${reply}" from ${phone}`);

  const parent = await prisma.parent.findUnique({
    where: { phone },
    include: { student: true },
  });

  if (!parent) return null;

  const log = await prisma.attendanceLog.findFirst({
    where: {
      studentId: parent.student.id,
      parentReply: null,
      parentNotifiedAt: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!log) {
    console.warn(`[Attendance] ⚠️  No pending attendance log found for ${parent.student.name} (${phone})`);
    return null;
  }

  console.log(`[Attendance] ✅ Attendance reply recorded: ${reply} for ${parent.student.name}`);

  await prisma.attendanceLog.update({
    where: { id: log.id },
    data: { parentReply: reply as 'SICK' | 'KNOWN' | 'PRESENT' },
  });

  const responses: Record<string, string> = {
    SICK: `✅ Thank you for letting us know. We hope ${parent.student.name} feels better soon. Get well soon! 🌟`,
    KNOWN: `✅ Noted. Thank you for informing us about ${parent.student.name}'s absence.`,
    PRESENT: `✅ Thank you for flagging this. We will recheck the attendance for ${parent.student.name} and update you shortly.`,
  };

  return responses[reply] || null;
}