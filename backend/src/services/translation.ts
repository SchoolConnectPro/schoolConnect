import { translateMessage } from '../lib/claude';

/**
 * Get a message localized to the given LanguageCode.
 *
 * - EN  → returned as-is (no API call)
 * - HI  → translated to Hindi via Claude
 * - PA  → translated to Punjabi via Claude
 *
 * The `cache` parameter is an optional Map you can pass in to share
 * translations across multiple parents in the same broadcast, so Claude
 * is called at most once per language per notification.
 *
 * @param message      - The English source message
 * @param languageCode - Target language ('EN' | 'HI' | 'PA')
 * @param cache        - Optional shared translation cache for this send batch
 */
export async function getLocalizedMessage(
  message: string,
  languageCode: 'EN' | 'HI' | 'PA',
  cache?: Map<string, string>
): Promise<string> {
  // English — no translation needed
  if (languageCode === 'EN') return message;

  // Check cache first
  if (cache?.has(languageCode)) {
    return cache.get(languageCode)!;
  }

  // Call Claude to translate
  console.log(`[Translation] Translating to ${languageCode} via Claude…`);
  const translated = await translateMessage(message, languageCode);

  // Store in cache for reuse within this batch
  cache?.set(languageCode, translated);

  return translated;
}