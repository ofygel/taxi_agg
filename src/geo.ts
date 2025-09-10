export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

export function parseMapLink(text?: string | null):
  | { lat: number; lon: number; label?: string }
  | null {
  if (!text) return null;
  const t = text.trim();

  const m2 = t.match(/[?&]m=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,\d+)?/i);
  if (m2) {
    const lon = Number(m2[1]);
    const lat = Number(m2[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }

  const g2 = t.match(/\/geo\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (g2) {
    const lat = Number(g2[1]);
    const lon = Number(g2[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }

  const gg = t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/);
  if (gg) {
    const lat = Number(gg[1]);
    const lon = Number(gg[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }

  const gg2 = t.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (gg2) {
    const lat = Number(gg2[1]);
    const lon = Number(gg2[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }

  const ya = t.match(/[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (ya) {
    const lon = Number(ya[1]);
    const lat = Number(ya[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }

  const osm = t.match(/[?&]map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
  if (osm) {
    const lat = Number(osm[1]);
    const lon = Number(osm[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }

  return null;
}

export function makeGeoLink(p: { lat: number; lon: number }) {
  return `https://2gis.kz/geo/${p.lat},${p.lon}`;
}
