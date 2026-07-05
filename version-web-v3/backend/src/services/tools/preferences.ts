import { setGlobalPreferences, getGlobalPreferences } from '../globalPreferencesService';
import { ToolResult, EmitFn, firstOf } from './utils';

function normalizeMobility(v: string): string {
  const m = v.toLowerCase();
  const valid = ['wheelchair', 'cane', 'slow', 'fast', 'hearing_impaired', 'visually_impaired',
    'elderly', 'with_kids', 'pregnant', 'other_needs'];
  if (valid.includes(m)) return m;
  if (m.includes('wheelchair') || m.includes('chair')) return 'wheelchair';
  if (m.includes('cane') || m.includes('stick') || m.includes('limited') || m.includes('difficult')) return 'cane';
  if (m.includes('slow') || m.includes('elderly') || m.includes('old') || m.includes('senior')) return 'elderly';
  if (m.includes('kid') || m.includes('child') || m.includes('stroller') || m.includes('baby') || m.includes('family')) return 'with_kids';
  if (m.includes('preg') || m.includes('expect')) return 'pregnant';
  if (m.includes('fast') || m.includes('athlete') || m.includes('good')) return 'fast';
  if (m.includes('hear') || m.includes('deaf')) return 'hearing_impaired';
  if (m.includes('vis') || m.includes('blind') || m.includes('sight')) return 'visually_impaired';
  if (m.includes('other') || m.includes('need') || m.includes('access') || m.includes('disab')) return 'other_needs';
  return '';
}

export async function setPreferencesTool(args: any, emit: EmitFn): Promise<ToolResult> {
  const mobility = firstOf(args, 'mobility', 'speed') || '';
  const normalized = mobility ? normalizeMobility(mobility) : '';
  const changes: Record<string, string | string[] | number> = {};
  if (normalized) changes.mobility = normalized;
  if (Array.isArray(args.interests) && args.interests.length > 0) changes.interests = args.interests;
  if (args.budget_level || args.budget) {
    const budgetMap: Record<string, string> = { cheap: 'cheap', moderate: 'medium', medium: 'medium', expensive: 'expensive', tight: 'cheap', budget: 'cheap', splurge: 'expensive' };
    changes.budget_level = budgetMap[(args.budget_level || args.budget || '').toLowerCase()] || 'medium';
  }
  if (args.budget_min_hkd != null || args.min_hkd != null) changes.budget_min_hkd = args.budget_min_hkd ?? args.min_hkd;
  if (args.budget_max_hkd != null || args.max_hkd != null) changes.budget_max_hkd = args.budget_max_hkd ?? args.max_hkd;
  if (args.home_base) changes.home_base = args.home_base;
  if (args.confirmed_itinerary_id != null) changes.confirmed_itinerary_id = args.confirmed_itinerary_id;

  if (Object.keys(changes).length === 0) {
    return { response: 'I didn\'t catch any preferences to save. You can tell me about your mobility, interests, budget, or where you\'re staying.' };
  }

  await setGlobalPreferences(changes);
  const prefs = await getGlobalPreferences();
  const parts: string[] = [];
  if (prefs.mobility !== 'none') parts.push(`mobility: ${prefs.mobility}`);
  if (prefs.interests.length > 0) parts.push(`interests: ${prefs.interests.join(', ')}`);
  if (prefs.budget_level && prefs.budget_level !== 'medium') parts.push(`budget: ${prefs.budget_level}`);
  if (prefs.budget_min_hkd != null && prefs.budget_max_hkd != null) parts.push(`daily budget: HK$${prefs.budget_min_hkd}-HK$${prefs.budget_max_hkd}`);
  if (prefs.home_base) parts.push(`staying in: ${prefs.home_base}`);
  if (prefs.confirmed_itinerary_id != null) parts.push(`using itinerary #${prefs.confirmed_itinerary_id} (pinned)`);

  emit('Saved your preferences!');
  return { response: `I've saved your preferences: ${parts.join('; ')}. I'll use these to tailor recommendations going forward.` };
}
