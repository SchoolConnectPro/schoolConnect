import { Router, Request, Response } from 'express';
import { processTeacherMessage } from '../services/messageAgent';
import { handleParentAttendanceReply } from '../services/attendance';
import { handleParentOptInOut } from '../services/optIn';
import { buildTwiMLResponse } from '../lib/twilio';

const router = Router();

/**
 * POST /webhook/twilio
 *
 * Twilio sends all incoming WhatsApp messages here.
 * This handles both teacher messages and parent replies.
 */
router.post('/twilio', async (req: Request, res: Response) => {
  const { From, Body, MessageSid } = req.body as {
    From: string;
    Body: string;
    MessageSid: string;
  };

  console.log(`[Webhook] Incoming message | From: ${From} | SID: ${MessageSid}`);
  console.log(`[Webhook] Body: "${Body}"`);

  if (!From || !Body) {
    res.status(400).send('Missing From or Body');
    return;
  }

  // Set content type for TwiML response
  res.set('Content-Type', 'text/xml');

  try {
    // ── Check if this is a parent opt-in / opt-out / language command ──────
    const optInResponse = await handleParentOptInOut(From, Body);

    if (optInResponse !== null) {
      console.log(`[Webhook] Opt-in/out handled for ${From}`);
      res.send(optInResponse);
      return;
    }

    // ── Check if this is a parent reply (SICK / KNOWN / PRESENT) ──────────
    const parentReply = await handleParentAttendanceReply(From, Body);

    if (parentReply !== null) {
      console.log(`[Webhook] Parent reply handled for ${From}`);
      res.send(buildTwiMLResponse(parentReply));
      return;
    }

    // ── Otherwise treat as a teacher message ──────────────────────────────
    const twimlResponse = await processTeacherMessage(From, Body);
    res.send(twimlResponse);
  } catch (err) {
    console.error('[Webhook] Unhandled error:', err);
    res.send(
      buildTwiMLResponse(
        '⚠️ An unexpected error occurred. Please try again or contact support.'
      )
    );
  }
});

/**
 * GET /webhook/twilio
 * Twilio sometimes sends a GET request to verify the webhook URL.
 */
router.get('/twilio', (_req: Request, res: Response) => {
  res.status(200).send('SchoolConnect webhook is active ✅');
});

/**
 * POST /webhook/twilio/status
 * Twilio delivery status callbacks (optional — for tracking delivered/failed)
 */
router.post('/twilio/status', async (req: Request, res: Response) => {
  const { MessageSid, MessageStatus } = req.body as {
    MessageSid: string;
    MessageStatus: string;
  };

  console.log(`[Webhook] Status update | SID: ${MessageSid} | Status: ${MessageStatus}`);

  // TODO: Update MessageLog.status based on MessageSid
  // This is optional for the MVP demo

  res.status(200).send('OK');
});

export default router;