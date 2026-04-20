# SchoolConnect — Backend

AI-powered school communication platform backend. Teachers send natural WhatsApp messages; the AI agent formats and broadcasts them to parents automatically.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Database | PostgreSQL via Supabase + Prisma ORM |
| AI Engine | Claude API (`claude-sonnet-4-5`) by Anthropic |
| WhatsApp | Twilio WhatsApp API |
| Scheduler | node-cron |

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Demo seed data
├── src/
│   ├── lib/
│   │   ├── claude.ts        # Anthropic Claude client + prompts
│   │   └── twilio.ts        # Twilio WhatsApp client
│   ├── services/
│   │   ├── messageAgent.ts  # Main teacher message processor
│   │   ├── broadcast.ts     # Send notifications to parent lists
│   │   ├── attendance.ts    # Absence alerts + parent reply handling
│   │   └── scheduler.ts     # node-cron for scheduled notifications
│   ├── routes/
│   │   ├── webhook.ts       # POST /webhook/twilio (Twilio → server)
│   │   └── admin.ts         # REST API for frontend dashboard
│   ├── types/
│   │   └── index.ts         # Shared TypeScript types
│   └── index.ts             # Express app entry point
├── .env.example             # Environment variable template
├── package.json
└── tsconfig.json
```

---

## Quick Start

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
ANTHROPIC_API_KEY=sk-ant-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
PORT=3000
```

### 3. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (creates all tables)
npm run db:migrate

# Seed demo data
npm run db:seed
```

> ⚠️ Before seeding, open `prisma/seed.ts` and replace the placeholder phone numbers with your actual WhatsApp numbers.

### 4. Start the development server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### 5. Expose webhook with ngrok

Twilio needs a public URL to send webhook events. Use ngrok:

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g. `https://abc123.ngrok.io`) and set it in Twilio:

**Twilio Console → Messaging → WhatsApp Sandbox → Sandbox Configuration**

Set "When a message comes in" to:
```
https://abc123.ngrok.io/webhook/twilio
```

---

## API Reference

### Webhook

| Method | Route | Description |
|---|---|---|
| POST | `/webhook/twilio` | Receives all incoming WhatsApp messages |
| GET | `/webhook/twilio` | Health check for Twilio |
| POST | `/webhook/twilio/status` | Delivery status callbacks |

### Admin API

| Method | Route | Description |
|---|---|---|
| GET | `/api/notifications` | List all sent notifications |
| GET | `/api/notifications/:id` | Single notification + delivery stats |
| GET | `/api/classes` | List all classes |
| GET | `/api/classes/:id/parents` | Parents in a class |
| GET | `/api/students` | List all students |
| POST | `/api/students` | Add a student + parent |
| GET | `/api/teachers` | List all teachers |
| POST | `/api/teachers` | Register a teacher |
| POST | `/api/test-message` | Send a test WhatsApp message |
| GET | `/api/attendance` | Recent attendance logs |
| GET | `/api/schools` | List schools |

### Health Check

```
GET /health
```

---

## Message Flow

```
Teacher sends WhatsApp message
  ↓
Twilio receives it → POST /webhook/twilio
  ↓
Identify teacher by phone number
  ↓
Claude AI classifies intent:
  ATTENDANCE → handleAbsence() → notify parent
  BROADCAST  → broadcastToClass() → notify all parents in class
  TEST_REMINDER / EVENT / HOMEWORK → broadcastToClass()
  EMERGENCY  → broadcastToClass(null) → notify ALL parents
  ↓
Teacher receives confirmation: "✅ Sent to 34 parents"
```

---

## Teacher Commands (via WhatsApp)

| Message | Action |
|---|---|
| `Diksha absent class 8B` | Sends absence alert to Diksha's parent |
| `Math test 25 April chapters 4-5 grade 8B` | Broadcasts test reminder to all 8B parents |
| `Sports Day on 30 April all classes` | School-wide event notification |
| `STATUS` | Shows last 3 sent messages |
| `HELP` | Shows usage examples |

---

## Parent Replies (Attendance)

When a parent receives an absence alert, they can reply:

| Reply | Meaning |
|---|---|
| `SICK` | Child is ill — leave noted |
| `KNOWN` | Parent acknowledges the absence |
| `PRESENT` | Parent disputes — school will recheck |

---

## Database Schema

```
School
  └── Teacher (many)
  └── Class (many)
       └── Student (many)
            └── Parent (one)
  └── Notification (many)
       └── MessageLog (one per parent)

AttendanceLog
  └── Student
  └── Teacher (who marked)
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Claude API key from console.anthropic.com |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID from console.twilio.com |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | Twilio sandbox number e.g. `whatsapp:+14155238886` |
| `PORT` | Server port (default: 3000) |
| `NODE_ENV` | `development` or `production` |

---

## Demo Setup Checklist

- [ ] `npm install` completed
- [ ] `.env` file created with all keys
- [ ] Supabase project created, `DATABASE_URL` set
- [ ] `npm run db:migrate` run successfully
- [ ] Phone numbers updated in `prisma/seed.ts`
- [ ] `npm run db:seed` run successfully
- [ ] `npm run dev` — server running on port 3000
- [ ] ngrok running — public URL obtained
- [ ] Twilio sandbox webhook URL set to `https://YOUR-NGROK-URL/webhook/twilio`
- [ ] Teacher's phone joined Twilio sandbox (send "join [sandbox-keyword]" to Twilio number)
- [ ] Test: teacher sends "Diksha absent class 8B" → parent receives WhatsApp alert ✅

---

## Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled production build
npm run db:migrate   # Run Prisma migrations
npm run db:generate  # Regenerate Prisma client
npm run db:seed      # Seed demo data
npm run db:studio    # Open Prisma Studio (visual DB browser)