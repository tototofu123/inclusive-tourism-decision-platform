import { chatCompletion } from './apiClient';
import { setPreferences } from './preferencesService';

export async function inferFromChat(text: string, botResponse: string, thinking: string[], sessionId: number): Promise<void> {
  if (!sessionId) return;

  const combined = [
    `User: ${text.slice(0, 500)}`,
    botResponse ? `Assistant: ${botResponse.slice(0, 500)}` : '',
    thinking.length > 0 ? `Reasoning: ${thinking.join(' ').slice(0, 500)}` : '',
  ].filter(Boolean).join('\n');

  const prompt = [
    `Extract travel preferences from this conversation. Return ONLY JSON.`,
    `Possible fields (omit if unclear):`,
    `- "mobility": "none|wheelchair|cane|slow|fast|hearing_impaired|visually_impaired"`,
    `- "interests": string[] from: museum,cafe,restaurant,park,temple,shopping_mall,viewpoint,market,art_gallery,historic_site,hotel`,
    `- "budget_level": "cheap|medium|expensive"`,
    `- "home_base": area name the user is staying in`,
    `Conversation:\n${combined}`,
  ].join('\n');

  try {
    const resp = await chatCompletion([
      { role: 'system', content: 'You extract preferences. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ], undefined, { temperature: 0, maxTokens: 300 });

    const parsed = JSON.parse(resp.content.replace(/```json|```/g, '').trim());
    const updates: Record<string, any> = {};
    if (parsed.mobility && parsed.mobility !== 'none') updates.mobility = parsed.mobility;
    if (Array.isArray(parsed.interests) && parsed.interests.length > 0) updates.interests = parsed.interests;
    if (parsed.budget_level) updates.budget_level = parsed.budget_level;
    if (parsed.home_base) updates.home_base = parsed.home_base;

    if (Object.keys(updates).length > 0) {
      await setPreferences(sessionId, updates);
      console.log('  [prefs] inferred:', JSON.stringify(updates));
    }
  } catch {
    // Non-fatal — preferences are a nice-to-have
  }
}
