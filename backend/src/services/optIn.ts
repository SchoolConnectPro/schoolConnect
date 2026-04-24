import { buildTwiMLResponse } from '../lib/twilio';
import prisma from '../lib/prisma';

// ─────────────────────────────────────────────
// In-memory state: tracks parents currently in the language-selection flow.
// Key: normalized phone number (e.g. "+919876543210")
// Value: 'AWAITING_LANGUAGE'
// ─────────────────────────────────────────────
const pendingLanguageSelection = new Map<string, 'AWAITING_LANGUAGE'>();

// ─────────────────────────────────────────────
// Language menu text
// ─────────────────────────────────────────────
const LANGUAGE_MENU =
  `🌐 *Choose your preferred language / अपनी भाषा चुनें / ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ*\n\n` +
  `Reply with:\n` +
  `1️⃣  *1* or *EN* — English\n` +
  `2️⃣  *2* or *HI* — हिंदी (Hindi)\n` +
  `3️⃣  *3* or *PA* — ਪੰਜਾਬੀ (Punjabi)`;

const LANGUAGE_LABELS: Record<string, string> = {
  EN: 'English',
  HI: 'हिंदी (Hindi)',
  PA: 'ਪੰਜਾਬੀ (Punjabi)',
};

/**
 * Map a parent's reply to a LanguageCode.
 * Accepts: "1" / "EN" → EN, "2" / "HI" → HI, "3" / "PA" → PA
 */
function parseLanguageChoice(reply: string): 'EN' | 'HI' | 'PA' | null {
  const r = reply.trim().toUpperCase();
  if (r === '1' || r === 'EN' || r === 'ENGLISH') return 'EN';
  if (r === '2' || r === 'HI' || r === 'HINDI') return 'HI';
  if (r === '3' || r === 'PA' || r === 'PUNJABI') return 'PA';
  return null;
}

/**
 * Handle a parent's opt-in / opt-out / language-preference message.
 *
 * Returns a TwiML XML string if the message was handled, or null if it
 * should be passed on to the next handler (attendance reply / teacher flow).
 *
 * @param parentPhone - Normalized phone number e.g. "+919876543210"
 * @param messageBody - Raw text sent by the parent
 */
export async function handleParentOptInOut(
  parentPhone: string,
  messageBody: string
): Promise<string | null> {
  const phone = parentPhone.replace('whatsapp:', '');
  const body = messageBody.trim();
  const upper = body.toUpperCase();

  // ── 1. Check if this parent is awaiting a language selection ──────────────
  if (pendingLanguageSelection.has(phone)) {
    const langCode = parseLanguageChoice(body);

    if (langCode) {
      pendingLanguageSelection.delete(phone);

      // Update language preference in DB
      const updated = await prisma.parent.updateMany({
        where: { phone },
        data: { languagePreference: langCode },
      });

      if (updated.count === 0) {
        console.warn(`[OptIn] ⚠️  Language choice received but phone not found in DB: ${phone}`);
        return null;
      }

      console.log(`[OptIn] 🌐 Language set to ${langCode} for ${phone}`);
      const langLabel = LANGUAGE_LABELS[langCode];
      return buildTwiMLResponse(
        `✅ *Language updated!*\n\n` +
          `Your preferred language is now set to *${langLabel}*.\n\n` +
          `You will receive SchoolConnect notifications in ${langLabel}. 🎉`
      );
    }

    // ── Not a language choice ──────────────────────────────────────────────
    const OPT_OUT_WHILE_PENDING = ['STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPTOUT', 'CANCEL', 'QUIT'];
    if (OPT_OUT_WHILE_PENDING.includes(upper)) {
      console.log(`[OptIn] 🔄 Opt-out received during language flow — clearing pending state for ${phone}`);
      pendingLanguageSelection.delete(phone);
      // Fall through to the opt-out handler below
    } else {
      console.log(`[OptIn] ↩️  Non-language message "${upper}" during language flow — clearing state, passing through for ${phone}`);
      pendingLanguageSelection.delete(phone);
      return null;
    }
  }

  // ── 2. OPT-OUT commands ───────────────────────────────────────────────────
  const OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPTOUT', 'CANCEL', 'QUIT'];
  if (OPT_OUT_KEYWORDS.includes(upper)) {
    console.log(`[OptIn] 🛑 Opt-out command "${upper}" from ${phone}`);
    const parent = await prisma.parent.findUnique({ where: { phone } });

    if (!parent) {
      console.log(`[OptIn]    → Not a registered parent — passing through`);
      return null;
    }

    if (!parent.optedIn) {
      console.log(`[OptIn]    → Already opted out (${parent.name})`);
      return buildTwiMLResponse(
        `ℹ️ You are already opted out of SchoolConnect notifications.\n\n` +
          `To opt back in, reply *START*.`
      );
    }

    await prisma.parent.update({
      where: { phone },
      data: { optedIn: false },
    });

    console.log(`[OptIn] ✅ ${parent.name} (${phone}) opted OUT`);

    return buildTwiMLResponse(
      `✅ *You have been unsubscribed.*\n\n` +
        `You will no longer receive notifications from SchoolConnect.\n\n` +
        `To opt back in at any time, reply *START*.`
    );
  }

  // ── 3. OPT-IN commands ────────────────────────────────────────────────────
  const OPT_IN_KEYWORDS = ['START', 'SUBSCRIBE', 'OPT IN', 'OPTIN', 'JOIN', 'YES'];
  if (OPT_IN_KEYWORDS.includes(upper)) {
    console.log(`[OptIn] 🟢 Opt-in command "${upper}" from ${phone}`);
    const parent = await prisma.parent.findUnique({ where: { phone } });

    if (!parent) {
      console.log(`[OptIn]    → Not a registered parent — passing through`);
      return null;
    }

    if (parent.optedIn) {
      console.log(`[OptIn]    → Already opted in (${parent.name}) — offering language change`);
      pendingLanguageSelection.set(phone, 'AWAITING_LANGUAGE');
      return buildTwiMLResponse(
        `ℹ️ You are already subscribed to SchoolConnect notifications.\n\n` +
          `Would you like to update your language preference?\n\n${LANGUAGE_MENU}`
      );
    }

    // Opt them back in
    await prisma.parent.update({
      where: { phone },
      data: { optedIn: true },
    });

    console.log(`[OptIn] ✅ ${parent.name} (${phone}) opted IN`);

    // Ask for language preference
    pendingLanguageSelection.set(phone, 'AWAITING_LANGUAGE');

    return buildTwiMLResponse(
      `✅ *Welcome back to SchoolConnect!* 🎉\n\n` +
        `You will now receive school notifications for your child.\n\n` +
        `Please choose your preferred language:\n\n${LANGUAGE_MENU}`
    );
  }

  // ── 4. LANGUAGE change command (anytime) ──────────────────────────────────
  if (upper === 'LANGUAGE' || upper === 'LANG' || upper === 'CHANGE LANGUAGE') {
    console.log(`[OptIn] 🌐 Language change command from ${phone}`);
    const parent = await prisma.parent.findUnique({ where: { phone } });

    if (!parent) {
      console.log(`[OptIn]    → Not a registered parent — passing through`);
      return null;
    }

    console.log(`[OptIn]    → Current language: ${parent.languagePreference} (${parent.name})`);
    pendingLanguageSelection.set(phone, 'AWAITING_LANGUAGE');

    return buildTwiMLResponse(
      `🌐 *Language Preference*\n\n` +
        `Current language: *${LANGUAGE_LABELS[parent.languagePreference]}*\n\n` +
        `${LANGUAGE_MENU}`
    );
  }

  // ── 5. STATUS command for parents ─────────────────────────────────────────
  if (upper === 'MY STATUS' || upper === 'STATUS ME' || upper === 'STATUS') {
    console.log(`[OptIn] 📋 Status command from ${phone}`);
    const parent = await prisma.parent.findUnique({
      where: { phone },
      include: { student: { include: { class: true } } },
    });

    if (!parent) {
      console.log(`[OptIn]    → Not a registered parent — passing through`);
      return null;
    }

    console.log(`[OptIn]    → Found: ${parent.name} | optedIn: ${parent.optedIn} | lang: ${parent.languagePreference}`);

    const statusEmoji = parent.optedIn ? '✅' : '❌';
    const langLabel = LANGUAGE_LABELS[parent.languagePreference] || parent.languagePreference;
    const cls = parent.student?.class;
    const classLabel = cls ? `Class ${cls.grade}${cls.section}` : 'N/A';

    return buildTwiMLResponse(
      `📋 *Your SchoolConnect Status*\n\n` +
        `👤 Name: ${parent.name}\n` +
        `🎓 Child: ${parent.student?.name || 'N/A'} (${classLabel})\n` +
        `${statusEmoji} Notifications: ${parent.optedIn ? 'Subscribed' : 'Unsubscribed'}\n` +
        `🌐 Language: ${langLabel}\n\n` +
        `Commands:\n` +
        `• *STOP* — unsubscribe\n` +
        `• *START* — subscribe\n` +
        `• *LANGUAGE* — change language`
    );
  }

  // Not an opt-in/out command — pass to next handler
  return null;
}