import { setGlobalPreferences, getGlobalPreferences } from '../globalPreferencesService';
import { ToolResult, EmitFn, firstOf } from './utils';

function normalizeMobility(v: string): string {
  const m = v.toLowerCase();
  if (['wheelchair', 'cane', 'slow', 'fast', 'hearing_impaired', 'visually_impaired'].includes(m)) return m;
  if (m.includes('wheelchair') || m.includes('chair')) return 'wheelchair';
  if (m.includes('cane') || m.includes('stick') || m.includes('limited') || m.includes('difficult')) return 'cane';
  if (m.includes('slow') || m.includes('elderly') || m.includes('old')) return 'slow';
  if (m.includes('fast') || m.includes('athlete') || m.includes('good')) return 'fast';
  if (m.includes('hear') || m.includes('deaf')) return 'hearing_impaired';
  if (m.includes('vis') || m.includes('blind') || m.includes('sight')) return 'visually_impaired';
  return '';
}

export async function setPreferencesTool(args: any, emit: EmitFn): Promise<ToolResult> {
  const mobility = firstOf(args, 'mobility', 'speed') || '';
  const normalized = mobility ? normalizeMobility(mobility) : '';
  const changes: Record<string, string | string[]> = {};
  if (normalized) changes.mobility = normalized;
  if (Array.isArray(args.interests) && args.interests.length > 0) changes.interests = args.interests;
  if (args.budget_level || args.budget) {
    const budgetMap: Record<string, string> = { cheap: 'cheap', moderate: 'medium', medium: 'medium', expensive: 'expensive' };
    changes.budget_level = budgetMap[(args.budget_level || args.budget || '').toLowerCase()] || 'medium';
  }
  if (args.home_base) changes.home_base = args.home_base;

  if (Object.keys(changes).length === 0) {
    return { response: 'I didn\'t catch any preferences to save. You can tell me about your mobility, interests, budget, or where you\'re staying.' };
  }

  await setGlobalPreferences(changes);
  const prefs = await getGlobalPreferences();
  const parts: string[] = [];
  if (prefs.mobility !== 'none') parts.push(`mobility: ${prefs.mobility}`);
  if (prefs.interests.length > 0) parts.push(`interests: ${prefs.interests.join(', ')}`);
  if (prefs.budget_level && prefs.budget_level !== 'medium') parts.push(`budget: ${prefs.budget_level}`);
  if (prefs.home_base) parts.push(`staying in: ${prefs.home_base}`);

  emit('Saved your preferences!');
  return { response: `I've saved your preferences: ${parts.join('; ')}. I'll use these to tailor recommendations going forward.` };
}
