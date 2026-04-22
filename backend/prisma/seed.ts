import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Demo seed data for SchoolConnect MVP
 *
 * Creates:
 * - 1 School: St. Mary's School, Jalandhar
 * - 4 Classes: 7A, 7B, 8A, 8B
 * - 2 Teachers (update phone numbers to your actual WhatsApp numbers)
 * - 10 Students with parents (update parent phones to your test numbers)
 */
async function main() {
  console.log('🌱 Seeding SchoolConnect demo data...\n');

  // ── School ──────────────────────────────────────────────────────────────
  const school = await prisma.school.upsert({
    where: { whatsappNumber: '+911234567890' },
    update: {},
    create: {
      name: "St. Mary's School",
      address: 'Model Town, Jalandhar',
      city: 'Jalandhar',
      whatsappNumber: '+911234567890',
    },
  });

  console.log(`✅ School: ${school.name} (${school.id})`);

  // ── Classes ─────────────────────────────────────────────────────────────
  const classData = [
    { grade: '7', section: 'A' },
    { grade: '7', section: 'B' },
    { grade: '8', section: 'A' },
    { grade: '8', section: 'B' },
  ];

  const classes: Record<string, string> = {};

  for (const c of classData) {
    const cls = await prisma.class.upsert({
      where: {
        grade_section_schoolId: {
          grade: c.grade,
          section: c.section,
          schoolId: school.id,
        },
      },
      update: {},
      create: {
        grade: c.grade,
        section: c.section,
        schoolId: school.id,
      },
    });
    classes[`${c.grade}${c.section}`] = cls.id;
    console.log(`✅ Class: ${c.grade}${c.section} (${cls.id})`);
  }

  // ── Teachers ─────────────────────────────────────────────────────────────
  // ⚠️  IMPORTANT: Replace these phone numbers with your actual WhatsApp numbers
  //    Format: +91XXXXXXXXXX (Indian numbers) or +1XXXXXXXXXX (US/Twilio sandbox)
  const teacherData = [
    {
      name: 'Arshdeep Singh',
      phone: '+918146055339', // Your WhatsApp number — Teacher 1
      subject: 'Mathematics',
      classKeys: ['8A', '8B'],
    },
    {
      name: 'Rajesh Kumar',
      phone: '+919876543211', // ← REPLACE with a second teacher's WhatsApp number
      subject: 'Science',
      classKeys: ['7A', '7B'],
    },
  ];

  for (const t of teacherData) {
    const teacher = await prisma.teacher.upsert({
      where: { phone: t.phone },
      update: {},
      create: {
        name: t.name,
        phone: t.phone,
        subject: t.subject,
        schoolId: school.id,
      },
    });

    // Assign classes to teacher
    for (const key of t.classKeys) {
      const classId = classes[key];
      if (classId) {
        await prisma.teacherClass.upsert({
          where: {
            teacherId_classId: {
              teacherId: teacher.id,
              classId,
            },
          },
          update: {},
          create: {
            teacherId: teacher.id,
            classId,
          },
        });
      }
    }

    console.log(`✅ Teacher: ${t.name} — ${t.phone}`);
  }

  // ── Students & Parents ───────────────────────────────────────────────────
  // ⚠️  IMPORTANT: Replace parent phone numbers with your test WhatsApp numbers
  //    Use your own phone or friends' phones to receive demo messages
  const studentData = [
    // Class 8B — 5 students
    {
      name: 'Diksha Sharma',
      rollNumber: '01',
      classKey: '8B',
      parentName: 'Sunita Sharma',
      parentPhone: '+919000000001', // ← REPLACE with a test phone number
    },
    {
      name: 'Rahul Verma',
      rollNumber: '02',
      classKey: '8B',
      parentName: 'Amit Verma',
      parentPhone: '+919000000002', // ← REPLACE with a test phone number
    },
    {
      name: 'Priya Singh',
      rollNumber: '03',
      classKey: '8B',
      parentName: 'Harpreet Singh',
      parentPhone: '+919056343865', // ← REPLACE with a test phone number
    },
    {
      name: 'Arjun Gupta',
      rollNumber: '04',
      classKey: '8B',
      parentName: 'Deepak Gupta',
      parentPhone: '+919000000004', // ← REPLACE with a test phone number
    },
    {
      name: 'Simran Kaur',
      rollNumber: '05',
      classKey: '8B',
      parentName: 'Gurpreet Kaur',
      parentPhone: '+916283967213', // ← REPLACE with a test phone number
    },
    // Class 8A — 3 students
    {
      name: 'Ananya Patel',
      rollNumber: '01',
      classKey: '8A',
      parentName: 'Ramesh Patel',
      parentPhone: '+919000000006', // ← REPLACE with a test phone number
    },
    {
      name: 'Vikram Joshi',
      rollNumber: '02',
      classKey: '8A',
      parentName: 'Suresh Joshi',
      parentPhone: '+919000000007', // ← REPLACE with a test phone number
    },
    {
      name: 'Neha Malhotra',
      rollNumber: '03',
      classKey: '8A',
      parentName: 'Rajiv Malhotra',
      parentPhone: '+919000000008', // ← REPLACE with a test phone number
    },
    // Class 7B — 2 students
    {
      name: 'Kabir Mehta',
      rollNumber: '01',
      classKey: '7B',
      parentName: 'Sanjay Mehta',
      parentPhone: '+919000000009', // ← REPLACE with a test phone number
    },
    {
      name: 'Ishaan Chopra',
      rollNumber: '02',
      classKey: '7B',
      parentName: 'Vinod Chopra',
      parentPhone: '+919000000010', // ← REPLACE with a test phone number
    },
  ];

  for (const s of studentData) {
    const classId = classes[s.classKey];
    if (!classId) continue;

    // Check if student already exists
    const existing = await prisma.student.findFirst({
      where: { rollNumber: s.rollNumber, classId },
    });

    if (existing) {
      console.log(`⏭️  Student already exists: ${s.name}`);
      continue;
    }

    const student = await prisma.student.create({
      data: {
        name: s.name,
        rollNumber: s.rollNumber,
        classId,
        parent: {
          create: {
            name: s.parentName,
            phone: s.parentPhone,
            languagePreference: 'EN',
            optedIn: true,
          },
        },
      },
    });

    console.log(`✅ Student: ${s.name} (Class ${s.classKey}) — Parent: ${s.parentName} ${s.parentPhone}`);
  }

  console.log('\n✅ Seed complete!\n');
  console.log('📋 Next steps:');
  console.log('   1. Update teacher phone numbers in seed.ts to your WhatsApp numbers');
  console.log('   2. Update parent phone numbers to your test numbers');
  console.log('   3. Re-run: npm run db:seed');
  console.log('   4. Start the server: npm run dev');
  console.log('   5. Expose with ngrok: ngrok http 3000');
  console.log('   6. Set Twilio webhook URL to: https://YOUR-NGROK-URL/webhook/twilio\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });