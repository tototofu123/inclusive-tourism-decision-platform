const CITYBUS_BASE = 'https://rt.data.gov.hk/v2/transport/citybus';
const KMB_BASE = 'https://data.etabus.gov.hk/v1/transport/kmb';

interface BusEtaItem {
  route: string;
  direction: string;
  stopId: string;
  destEn: string;
  destTc: string;
  eta: string;
  etaSeq: number;
  rmkEn: string;
  company: string;
}

interface StopInfo {
  stopId: string;
  nameEn: string;
  nameTc: string;
  lat?: number;
  lng?: number;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

function parseEtaMinutes(etaIso: string): string {
  const etaMs = new Date(etaIso).getTime();
  const now = Date.now();
  const diffMin = Math.round((etaMs - now) / 60000);
  if (diffMin <= 0) return 'due';
  if (diffMin === 1) return '1 min';
  return `${diffMin} min`;
}

// ── KMB helpers ──

let kmbRouteStopCache: Array<{ route: string; bound: string; serviceType: string; seq: number; stop: string }> | null = null;

async function getKmbRouteStopCache(): Promise<any[]> {
  if (kmbRouteStopCache) return kmbRouteStopCache;
  try {
    const data = await fetchJson(`${KMB_BASE}/route-stop`);
    kmbRouteStopCache = (data.data || []).map((rs: any) => ({
      route: rs.route,
      bound: rs.bound,
      serviceType: rs.service_type,
      seq: parseInt(rs.seq) || 0,
      stop: rs.stop,
    }));
    return kmbRouteStopCache!;
  } catch {
    kmbRouteStopCache = [];
    return [];
  }
}

export async function getKmbRouteStops(route: string): Promise<StopInfo[]> {
  const all = await getKmbRouteStopCache();
  const matches = all.filter(rs => rs.route === route && rs.serviceType === '1');
  // Resolve stop names by deduplicating stop IDs
  const stopIds = [...new Set(matches.map(m => m.stop))];
  const stops: StopInfo[] = [];
  for (const stopId of stopIds) {
    try {
      const stopData = await fetchJson(`${KMB_BASE}/stop/${stopId}`);
      const s = stopData.data;
      stops.push({
        stopId,
        nameEn: s?.name_en || '',
        nameTc: s?.name_tc || '',
        lat: parseFloat(s?.lat),
        lng: parseFloat(s?.long),
      });
    } catch {
      stops.push({ stopId, nameEn: '', nameTc: '' });
    }
  }
  return stops;
}

export async function getKmbEta(stopId: string, route: string): Promise<BusEtaItem[]> {
  const data = await fetchJson(`${KMB_BASE}/eta/${stopId}/${route}/1`);
  const items: any[] = data.data || [];
  return items.map((e: any) => ({
    route: e.route || route,
    direction: e.dir === 'I' ? 'inbound' : 'outbound',
    stopId: e.stop || stopId,
    destEn: e.dest_en || '',
    destTc: e.dest_tc || '',
    eta: e.eta || '',
    etaSeq: parseInt(e.eta_seq) || 0,
    rmkEn: e.rmk_en || '',
    company: 'KMB',
  }));
}

// ── Citybus helpers ──

export async function getCitybusStop(stopId: string): Promise<StopInfo | null> {
  try {
    const data = await fetchJson(`${CITYBUS_BASE}/stop/${stopId}`);
    const s = data.data;
    if (!s) return null;
    return {
      stopId: s.stop,
      nameEn: s.name_en || '',
      nameTc: s.name_tc || '',
      lat: parseFloat(s.lat),
      lng: parseFloat(s.long),
    };
  } catch {
    return null;
  }
}

export async function getCitybusEta(stopId: string, route: string): Promise<BusEtaItem[]> {
  const data = await fetchJson(`${CITYBUS_BASE}/eta/CTB/${stopId}/${route}`);
  const items: any[] = data.data || [];
  return items.map((e: any) => ({
    route: e.route || route,
    direction: e.dir === 'I' ? 'inbound' : 'outbound',
    stopId: e.stop || stopId,
    destEn: e.dest_en || '',
    destTc: e.dest_tc || '',
    eta: e.eta || '',
    etaSeq: parseInt(e.eta_seq) || 0,
    rmkEn: e.rmk_en || '',
    company: 'CTB',
  }));
}

export async function getCitybusRouteInfo(route: string): Promise<{ origEn: string; destEn: string } | null> {
  try {
    const data = await fetchJson(`${CITYBUS_BASE}/route/CTB/${route}`);
    const r = data.data;
    if (!r) return null;
    return { origEn: r.orig_en || '', destEn: r.dest_en || '' };
  } catch {
    return null;
  }
}

// ── Stop name matching ──

async function resolveStopId(route: string, stopQuery: string, company: string): Promise<string | null> {
  if (/^\d{6}$/.test(stopQuery) || /^[A-Z0-9]{16}$/i.test(stopQuery)) {
    // Looks like an ID already
    return stopQuery;
  }

  const q = stopQuery.toLowerCase().trim();

  if (company === 'KMB') {
    try {
      const stops = await getKmbRouteStops(route);
      const match = stops.find(s => s.nameEn.toLowerCase().includes(q) || s.nameTc.toLowerCase().includes(q));
      if (match) return match.stopId;
    } catch {}
    try {
      const allStops = await fetchJson(`${KMB_BASE}/stop`);
      const all: any[] = allStops.data || [];
      const found = all.find((s: any) =>
        (s.name_en || '').toLowerCase().includes(q) || (s.name_tc || '').toLowerCase().includes(q)
      );
      if (found) return found.stop;
    } catch {}
  } else {
    // CTB: try to find stop by name — scan known stop IDs or skip
    // Without a search endpoint, we rely on the user providing a stop ID
    return null;
  }
  return null;
}

// ── Public API ──

export async function getBusEtaByRouteAndStop(
  route: string,
  stopQuery?: string,
  stopId?: string,
  company: string = 'CTB',
): Promise<{ response: string; etas: BusEtaItem[] }> {
  const resolvedStopId = stopId || (stopQuery ? await resolveStopId(route, stopQuery, company) : null);

  if (!resolvedStopId) {
    // No stop specified — return route info with origin/destination
    if (company === 'CTB') {
      const info = await getCitybusRouteInfo(route);
      if (info) {
        return {
          response: `Citybus route ${route}: ${info.origEn} → ${info.destEn}. Specify a stop name or 6-digit stop ID to get ETA.`,
          etas: [],
        };
      }
    }
    // KMB: list route info from route list
    try {
      const routes = await fetchJson(`${KMB_BASE}/route`);
      const all: any[] = routes.data || [];
      const match = all.find((r: any) => r.route === route && r.service_type === '1');
      if (match) {
        const dir = match.bound === 'O' ? 'outbound' : 'inbound';
        return {
          response: `KMB route ${route} (${dir}): ${match.orig_en} → ${match.dest_en}. Specify a stop name or 16-char stop ID to get ETA.`,
          etas: [],
        };
      }
    } catch {}
    return {
      response: `No route info found for ${company} route ${route}. Provide a stop name or ID.`,
      etas: [],
    };
  }

  const etas = company === 'KMB'
    ? await getKmbEta(resolvedStopId, route)
    : await getCitybusEta(resolvedStopId, route);

  if (etas.length === 0) {
    // Show stop name for context
    let stopName = resolvedStopId;
    if (company === 'CTB') {
      const info = await getCitybusStop(resolvedStopId);
      if (info) stopName = info.nameEn;
    }
    return {
      response: `No real-time ETA available for ${company} route ${route} at ${stopName}. It may be late — try another route or stop.`,
      etas: [],
    };
  }

  const lines = etas.slice(0, 3).map((e) => {
    const etaTime = e.eta ? parseEtaMinutes(e.eta) : 'unknown';
    const dest = e.destEn ? ` → ${e.destEn}` : '';
    const rmk = e.rmkEn ? ` (${e.rmkEn})` : '';
    return `  ${etaTime}${dest}${rmk}`;
  });

  const dir = etas[0].direction;
  return {
    response: `${company} route ${route} (${dir}):\n${lines.join('\n')}`,
    etas,
  };
}
