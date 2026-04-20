import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER!; // e.g. "whatsapp:+14155238886"

export const twilioClient = twilio(accountSid, authToken);

/**
 * Send a WhatsApp message via Twilio.
 * @param to - Recipient phone in E.164 format e.g. "+919876543210"
 * @param body - Message text
 * @returns Twilio message SID
 */
export async function sendWhatsApp(to: string, body: string): Promise<string> {
  // Ensure the number has the whatsapp: prefix
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  const message = await twilioClient.messages.create({
    from: fromNumber,
    to: toFormatted,
    body,
  });

  return message.sid;
}

/**
 * Send a TwiML response back to Twilio webhook.
 * Returns an XML string that Twilio expects as the HTTP response.
 * @param replyText - Text to send back to the sender (teacher)
 */
export function buildTwiMLResponse(replyText: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(replyText)}</Message>
</Response>`;
}

/**
 * Validate that an incoming request is genuinely from Twilio.
 */
export function validateTwilioRequest(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(authToken, signature, url, params);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}