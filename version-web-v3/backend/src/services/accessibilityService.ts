import { query } from '../db/client';

const OVERPASS_BASE = process.env.OVERPASS_BASE || 'https://overpass-api.de/api/interpreter';

export interface AccessibilityInfo {
  placeName: string;
  wheelchair: 'yes' | 'limited' | 'no' | 'unknown';
  stepFreeEntrance: boolean;
  accessibleToilet: boolean;
  elevator: boolean;
  tactilePaving: boolean;
  tags: string[];
  notes: string;
}

const ACCESSIBLE_MTR: Record<string, { name: string; elevator: boolean; accessibleToilet: boolean }> = {
  // Existing Kowloon stations (keep all originals)
  'TST': { name: 'Tsim Sha Tsui', elevator: true, accessibleToilet: true },
  'ETS': { name: 'East Tsim Sha Tsui', elevator: true, accessibleToilet: true },
  'JOR': { name: 'Jordan', elevator: true, accessibleToilet: true },
  'YMT': { name: 'Yau Ma Tei', elevator: true, accessibleToilet: false },
  'MOK': { name: 'Mong Kok', elevator: true, accessibleToilet: false },
  'PRE': { name: 'Prince Edward', elevator: true, accessibleToilet: true },
  'SSP': { name: 'Sham Shui Po', elevator: true, accessibleToilet: false },
  'CSW': { name: 'Cheung Sha Wan', elevator: true, accessibleToilet: false },
  'LCK': { name: 'Lai Chi Kok', elevator: true, accessibleToilet: true },
  'MEF': { name: 'Mei Foo', elevator: true, accessibleToilet: true },
  'HUH': { name: 'Hung Hom', elevator: true, accessibleToilet: true },
  'KOW': { name: 'Kowloon Tong', elevator: true, accessibleToilet: true },
  'DIH': { name: 'Diamond Hill', elevator: true, accessibleToilet: true },
  'CHH': { name: 'Choi Hung', elevator: true, accessibleToilet: false },
  'KOB': { name: 'Kowloon Bay', elevator: true, accessibleToilet: false },
  'NTK': { name: 'Ngau Tau Kok', elevator: true, accessibleToilet: false },
  'KWT': { name: 'Kwun Tong', elevator: true, accessibleToilet: true },
  'LAT': { name: 'Lam Tin', elevator: true, accessibleToilet: true },
  'WTS': { name: 'Wong Tai Sin', elevator: true, accessibleToilet: true },
  'LOP': { name: 'Lok Fu', elevator: true, accessibleToilet: false },
  'AUS': { name: 'Austin', elevator: true, accessibleToilet: true },
  'WAC': { name: 'Whampoa', elevator: true, accessibleToilet: true },
  // HK Island (Tsuen Wan + Island Line)
  'HOK': { name: 'Hong Kong', elevator: true, accessibleToilet: true },
  'CEN': { name: 'Central', elevator: true, accessibleToilet: true },
  'ADM': { name: 'Admiralty', elevator: true, accessibleToilet: true },
  'WCH': { name: 'Wan Chai', elevator: true, accessibleToilet: true },
  'CAB': { name: 'Causeway Bay', elevator: true, accessibleToilet: true },
  'TIH': { name: 'Tin Hau', elevator: true, accessibleToilet: false },
  'FOH': { name: 'Fortress Hill', elevator: true, accessibleToilet: false },
  'NOP': { name: 'North Point', elevator: true, accessibleToilet: true },
  'QUB': { name: 'Quarry Bay', elevator: true, accessibleToilet: false },
  'TAK': { name: 'Tai Koo', elevator: true, accessibleToilet: false },
  'SWH': { name: 'Sai Wan Ho', elevator: true, accessibleToilet: false },
  'SKW': { name: 'Shau Kei Wan', elevator: true, accessibleToilet: false },
  'SHE': { name: 'Sheung Wan', elevator: true, accessibleToilet: true },
  'SYP': { name: 'Sai Ying Pun', elevator: true, accessibleToilet: true },
  'HKU': { name: 'HKU', elevator: true, accessibleToilet: true },
  'KET': { name: 'Kennedy Town', elevator: true, accessibleToilet: false },
  // New Territories (Tsuen Wan + East Rail + Tuen Ma)
  'TSW': { name: 'Tsuen Wan', elevator: true, accessibleToilet: true },
  'TWH': { name: 'Tai Wo Hau', elevator: true, accessibleToilet: false },
  'KWF': { name: 'Kwai Fong', elevator: true, accessibleToilet: false },
  'KWH': { name: 'Kwai Hing', elevator: true, accessibleToilet: true },
  'SHA': { name: 'Sha Tin', elevator: true, accessibleToilet: true },
  'TAP': { name: 'Tai Po Market', elevator: true, accessibleToilet: true },
  'FOT': { name: 'Fo Tan', elevator: true, accessibleToilet: false },
  'UNI': { name: 'University', elevator: true, accessibleToilet: true },
  'FAN': { name: 'Fanling', elevator: true, accessibleToilet: true },
  'SHS': { name: 'Sheung Shui', elevator: true, accessibleToilet: true },
  'TKO': { name: 'Tseung Kwan O', elevator: true, accessibleToilet: true },
  'HAE': { name: 'Hang Hau', elevator: true, accessibleToilet: false },
  // South Island
  'SOU': { name: 'South Horizons', elevator: true, accessibleToilet: true },
  'LEI': { name: 'Lei Tung', elevator: true, accessibleToilet: false },
  'OCP': { name: 'Ocean Park', elevator: true, accessibleToilet: true },
  // Airport Express
  'TSY': { name: 'Tsing Yi', elevator: true, accessibleToilet: true },
  'SUN': { name: 'Sunny Bay', elevator: true, accessibleToilet: false },
  'TUC': { name: 'Tung Chung', elevator: true, accessibleToilet: true },
};

export function getAccessibleMTRStations(): string[] {
  return Object.values(ACCESSIBLE_MTR).map(s => s.name);
}

export function isMTRStationAccessible(stationName: string): boolean {
  const lower = stationName.toLowerCase();
  for (const v of Object.values(ACCESSIBLE_MTR)) {
    if (v.name.toLowerCase().includes(lower) || lower.includes(v.name.toLowerCase())) {
      return v.elevator;
    }
  }
  return false;
}

export async function getAccessibility(placeName: string): Promise<AccessibilityInfo> {
  const fromDb = await queryDbAccessibility(placeName);
  if (fromDb) return fromDb;

  const fromOverpass = await queryOverpassAccessibility(placeName);
  if (fromOverpass) return fromOverpass;

  return {
    placeName,
    wheelchair: 'unknown',
    stepFreeEntrance: false,
    accessibleToilet: false,
    elevator: false,
    tactilePaving: false,
    tags: [],
    notes: 'No detailed accessibility data available. Contact the venue directly, or check Accessible Hong Kong (www.accessiblehongkong.com).',
  };
}

async function queryDbAccessibility(name: string): Promise<AccessibilityInfo | null> {
  try {
    const rows = await query(
      'SELECT name, accessibility_tags, accessibility_score FROM places WHERE LOWER(name) LIKE $1 LIMIT 1',
      [`%${name.toLowerCase()}%`],
    );
    if (rows.rows.length === 0) return null;
    const r = rows.rows[0];
    const tags: string[] = r.accessibility_tags || [];
    const score = r.accessibility_score || 0;
    if (tags.length === 0 && score === 0) return null;

    const wc: AccessibilityInfo['wheelchair'] = score >= 4 ? 'yes' : score >= 2 ? 'limited' : score >= 1 ? 'limited' : 'no';
    const stepFree = tags.some(t => t.includes('step-free') || t.includes('ramp') || t.includes('level'));
    const toilet = tags.some(t => t.includes('toilet') || t.includes('bathroom'));
    const elevator = tags.some(t => t.includes('elevator') || t.includes('lift') || t.includes('elev'));
    const tactile = tags.some(t => t.includes('tactile') || t.includes('braille'));

    return {
      placeName: r.name,
      wheelchair: tags.length > 0 ? wc : 'unknown',
      stepFreeEntrance: stepFree,
      accessibleToilet: toilet,
      elevator: elevator,
      tactilePaving: tactile,
      tags,
      notes: tags.length > 0
        ? `From database: ${tags.join(', ')}.${elevator ? ' Has elevator.' : ''}${stepFree ? ' Step-free entrance.' : ''}${toilet ? ' Accessible toilet available.' : ''}`
        : 'No curated data available.',
    };
  } catch { return null; }
}

async function queryOverpassAccessibility(name: string): Promise<AccessibilityInfo | null> {
  const encoded = name.replace(/\(.*?\)/g, '').replace(/[^a-z0-9\s]/gi, '').trim().toLowerCase().slice(0, 50);
  try {
    const body = new URLSearchParams({
      data: `[out:json][timeout:10];(node["wheelchair"~"${encoded}",i](22.15,113.80,22.55,114.40);way["wheelchair"~"${encoded}",i](22.15,113.80,22.55,114.40););out body 3;`,
    });
    const res = await fetch(OVERPASS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'InclusiveTourismV3/1.0' },
      body,
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const el = data.elements?.[0];
    if (!el?.tags) return null;

    const wcTag = el.tags.wheelchair || 'unknown';
    const wc: AccessibilityInfo['wheelchair'] = (wcTag === 'yes' || wcTag === 'designated') ? 'yes' : wcTag === 'limited' ? 'limited' : wcTag === 'no' ? 'no' : 'unknown';

    const tags: string[] = [];
    if (wc === 'yes') tags.push('step-free access (confirmed)');
    if (wc === 'limited') tags.push('partial step-free access');
    if (wc === 'no') tags.push('not wheelchair accessible');
    if (el.tags.tactile_paving === 'yes') tags.push('tactile paving');
    if (el.tags.wheelchair_toilet === 'yes') tags.push('accessible toilet');
    if (el.tags.elevator === 'yes') tags.push('elevator');
    if (el.tags.ramp === 'yes') tags.push('ramp');
    if (el.tags.ramp === 'limited') tags.push('ramp (limited)');
    if (el.tags.hearing_loop === 'yes') tags.push('hearing loop');
    if (el.tags.braille === 'yes') tags.push('braille signage');

    return {
      placeName: el.tags.name || name,
      wheelchair: wc,
      stepFreeEntrance: wc === 'yes' || el.tags.ramp === 'yes',
      accessibleToilet: el.tags.wheelchair_toilet === 'yes',
      elevator: el.tags.elevator === 'yes',
      tactilePaving: el.tags.tactile_paving === 'yes',
      tags,
      notes: tags.length > 0
        ? `From OpenStreetMap: ${tags.join(', ')}.`
        : `Wheelchair access: ${wcTag}. No additional detail.`,
    };
  } catch { return null; }
}

export async function queryAllAccessibility(
): Promise<{ lat: number; lng: number; tags: Record<string, string> }[]> {
  try {
    const q = '[out:json][timeout:20];(node["wheelchair"](22.15,113.80,22.55,114.40);way["wheelchair"](22.15,113.80,22.55,114.40););out body 20;';
    const res = await fetch(OVERPASS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'InclusiveTourismV3/1.0' },
      body: new URLSearchParams({ data: q }),
    });
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.elements || []).map((el: any) => ({
      lat: el.lat || el.center?.lat || 0,
      lng: el.lon || el.center?.lon || 0,
      tags: el.tags || {},
    }));
  } catch { return []; }
}