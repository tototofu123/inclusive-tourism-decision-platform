import { query } from '../db/client';

export interface GlobalPreferences {
  mobility: string;
  interests: string[];
  budget_level: string;
  budget_min_hkd: number | null;
  budget_max_hkd: number | null;
  home_base: string;
  urgent_mode: boolean;
  confirmed_itinerary_id: number | null;
}

const DEFAULTS: GlobalPreferences = {
  mobility: 'none',
  interests: [],
  budget_level: 'medium',
  budget_min_hkd: null,
  budget_max_hkd: null,
  home_base: '',
  urgent_mode: false,
  confirmed_itinerary_id: null,
};

let cache: GlobalPreferences | null = null;

export async function getGlobalPreferences(): Promise<GlobalPreferences> {
  if (cache) return { ...cache };
  try {
    const r = await query('SELECT mobility, interests, budget_level, budget_min_hkd, budget_max_hkd, home_base, urgent_mode, confirmed_itinerary_id FROM global_preferences WHERE id=1');
    if (r.rows.length === 0) { cache = { ...DEFAULTS }; return { ...cache }; }
    const row = r.rows[0];
    cache = {
      mobility: row.mobility || 'none',
      interests: row.interests || [],
      budget_level: row.budget_level || 'medium',
      budget_min_hkd: row.budget_min_hkd != null ? row.budget_min_hkd : null,
      budget_max_hkd: row.budget_max_hkd != null ? row.budget_max_hkd : null,
      home_base: row.home_base || '',
      urgent_mode: row.urgent_mode || false,
      confirmed_itinerary_id: row.confirmed_itinerary_id || null,
    };
    return { ...cache };
  } catch {
    if (!cache) cache = { ...DEFAULTS };
    return { ...cache };
  }
}

export async function setGlobalPreferences(prefs: Partial<GlobalPreferences>): Promise<GlobalPreferences> {
  const current = await getGlobalPreferences();
  const merged = { ...current, ...prefs };
  cache = { ...merged };
  try {
    await query(
      `INSERT INTO global_preferences (id, mobility, interests, budget_level, budget_min_hkd, budget_max_hkd, home_base, urgent_mode, confirmed_itinerary_id, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         mobility=EXCLUDED.mobility, interests=EXCLUDED.interests, budget_level=EXCLUDED.budget_level,
         budget_min_hkd=EXCLUDED.budget_min_hkd, budget_max_hkd=EXCLUDED.budget_max_hkd,
         home_base=EXCLUDED.home_base, urgent_mode=EXCLUDED.urgent_mode,
         confirmed_itinerary_id=EXCLUDED.confirmed_itinerary_id, updated_at=NOW()`,
      [merged.mobility, merged.interests, merged.budget_level,
       merged.budget_min_hkd, merged.budget_max_hkd,
       merged.home_base, merged.urgent_mode ? 1 : 0, merged.confirmed_itinerary_id]
    );
  } catch (err) {
    console.error('setGlobalPreferences DB error (cache still active):', err);
  }
  return { ...merged };
}

export function formatGlobalPreferences(prefs: GlobalPreferences): string {
  const parts: string[] = [];
  if (prefs.mobility && prefs.mobility !== 'none') parts.push(`${prefs.mobility} user`);
  if (prefs.interests.length > 0) parts.push(`interested in ${prefs.interests.slice(0, 5).join(', ')}`);
  if (prefs.budget_level && prefs.budget_level !== 'medium') parts.push(`${prefs.budget_level} budget`);
  if (prefs.budget_min_hkd != null && prefs.budget_max_hkd != null) parts.push(`daily budget HK$${prefs.budget_min_hkd}-HK$${prefs.budget_max_hkd}`);
  if (prefs.home_base) parts.push(`staying in ${prefs.home_base}`);
  if (prefs.urgent_mode && prefs.confirmed_itinerary_id) parts.push(`itinerary #${prefs.confirmed_itinerary_id} is CONFIRMED`);
  return parts.length > 0 ? `User profile: ${parts.join(', ')}.` : '';
}
