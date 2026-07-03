import { query } from '../db/client';

export interface GlobalPreferences {
  mobility: string;
  interests: string[];
  budget_level: string;
  home_base: string;
}

const DEFAULTS: GlobalPreferences = {
  mobility: 'none',
  interests: [],
  budget_level: 'medium',
  home_base: '',
};

export async function getGlobalPreferences(): Promise<GlobalPreferences> {
  try {
    const r = await query('SELECT mobility, interests, budget_level, home_base FROM global_preferences WHERE id=1');
    if (r.rows.length === 0) return { ...DEFAULTS };
    const row = r.rows[0];
    return {
      mobility: row.mobility || 'none',
      interests: row.interests || [],
      budget_level: row.budget_level || 'medium',
      home_base: row.home_base || '',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function setGlobalPreferences(prefs: Partial<GlobalPreferences>): Promise<GlobalPreferences> {
  const current = await getGlobalPreferences();
  const merged = { ...current, ...prefs };
  try {
    await query(
      `UPDATE global_preferences SET mobility=$1, interests=$2, budget_level=$3, home_base=$4, updated_at=NOW() WHERE id=1`,
      [merged.mobility, merged.interests, merged.budget_level, merged.home_base]
    );
  } catch (err) {
    console.error('setGlobalPreferences error:', err);
  }
  return merged;
}

export function formatGlobalPreferences(prefs: GlobalPreferences): string {
  const parts: string[] = [];
  if (prefs.mobility && prefs.mobility !== 'none') parts.push(`${prefs.mobility} user`);
  if (prefs.interests.length > 0) parts.push(`interested in ${prefs.interests.slice(0, 5).join(', ')}`);
  if (prefs.budget_level && prefs.budget_level !== 'medium') parts.push(`${prefs.budget_level} budget`);
  if (prefs.home_base) parts.push(`staying in ${prefs.home_base}`);
  return parts.length > 0 ? `User profile: ${parts.join(', ')}.` : '';
}
