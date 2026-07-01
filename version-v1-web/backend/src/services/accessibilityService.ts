const OVERPASS_BASE = process.env.OVERPASS_BASE || 'https://overpass-api.de/api/interpreter';

export interface AccessibilityInfo {
  placeName: string;
  wheelchair: 'yes' | 'limited' | 'no' | 'unknown';
  tags: string[];
  notes: string;
}

export async function getAccessibility(placeName: string): Promise<AccessibilityInfo> {
  const fromOverpass = await queryOverpassAccessibility(placeName);
  if (fromOverpass) return fromOverpass;

  return {
    placeName,
    wheelchair: 'unknown',
    tags: [],
    notes: 'No detailed accessibility data available. Contact the venue or check in person.',
  };
}

export async function queryAllAccessibility(): Promise<{ lat: number; lng: number; tags: Record<string, string> }[]> {
  try {
    const q = `[out:json][timeout:20];(
      node["wheelchair"](22.29,114.15,22.34,114.20);
      way["wheelchair"](22.29,114.15,22.34,114.20);
    );out body 20;`;
    const res = await fetch(OVERPASS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: q }),
    });
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.elements || []).map((el: any) => ({
      lat: el.lat || el.center?.lat || 0,
      lng: el.lon || el.center?.lon || 0,
      tags: el.tags || {},
    }));
  } catch {
    return [];
  }
}

async function queryOverpassAccessibility(name: string): Promise<AccessibilityInfo | null> {
  const encoded = name.replace(/\(.*?\)/g, '').trim().toLowerCase();
  try {
    const q = `[out:json][timeout:10];(
      node["wheelchair"~"${encoded}",i](22.29,114.15,22.34,114.20);
      way["wheelchair"~"${encoded}",i](22.29,114.15,22.34,114.20);
    );out body 3;`;
    const res = await fetch(OVERPASS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: q }),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const el = data.elements?.[0];
    if (!el?.tags) return null;

    const wc = el.tags.wheelchair || 'unknown';
    const tags: string[] = [];
    if (el.tags.wheelchair === 'yes') tags.push('step-free');
    if (el.tags.wheelchair === 'limited') tags.push('step-free (limited)');
    if (el.tags.wheelchair === 'no') tags.push('not accessible');
    if (el.tags.tactile_paving === 'yes') tags.push('tactile paving');
    if (el.tags.wheelchair_toilet === 'yes') tags.push('accessible toilet');
    if (el.tags.elevator === 'yes' || el.tags.elevator === '2025-05-29') tags.push('elevator');
    if (el.tags.ramp === 'yes' || el.tags.ramp === 'limited') tags.push(el.tags.ramp === 'yes' ? 'ramp' : 'ramp (limited)');

    const notes = tags.length > 0
      ? `Features: ${tags.join(', ')}.`
      : `Wheelchair access: ${wc}. No additional tags.`;

    return {
      placeName: el.tags.name || name,
      wheelchair: wc as AccessibilityInfo['wheelchair'],
      tags,
      notes,
    };
  } catch {
    return null;
  }
}
