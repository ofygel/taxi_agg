import fetch from 'node-fetch';

import { CITY_BOUNDS, CITY_NAME, TWO_GIS_API_KEY, TWO_GIS_OPEN_URL } from './config';

export async function twoGisSuggest(q: string) {
  if (!TWO_GIS_API_KEY) return null;
  const url = `https://catalog.api.2gis.com/3.0/suggests?q=${encodeURIComponent(q)}&key=${TWO_GIS_API_KEY}&fields=items.point,items.full_address_name`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j: any = await r.json();
    const items = j?.result?.items || [];
    return items
      .filter((i: any) => i.point?.lat && i.point?.lon)
      .slice(0, 5)
      .map((i: any) => ({
        label: i.full_address_name || i.name,
        lat: Number(i.point.lat),
        lon: Number(i.point.lon)
      }));
  } catch { return null; }
}

export async function twoGisGeocode(q: string) {
  if (!TWO_GIS_API_KEY) return null;
  const url = `https://catalog.api.2gis.com/3.0/items/geocode?q=${encodeURIComponent(q)}&key=${TWO_GIS_API_KEY}&fields=items.point,items.full_address_name`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j: any = await r.json();
    const items = j?.result?.items || [];
    return items
      .filter((i: any) => i.point?.lat && i.point?.lon)
      .slice(0, 5)
      .map((i: any) => ({
        label: i.full_address_name || i.name,
        lat: Number(i.point.lat),
        lon: Number(i.point.lon)
      }));
  } catch { return null; }
}

export async function nominatimSearch(q: string) {
  const [lonMin, latMin, lonMax, latMax] = CITY_BOUNDS.split(/[;,]/).map(Number);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&bounded=1&viewbox=${lonMin},${latMax},${lonMax},${latMin}&q=${encodeURIComponent(q + ' ' + CITY_NAME)}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'tg-bot' } as any });
    if (!r.ok) return null;
    const j: any[] = await r.json();
    return j.slice(0, 5).map((i: any) => ({ label: i.display_name, lat: Number(i.lat), lon: Number(i.lon) }));
  } catch { return null; }
}

export async function geocodeSuggest(q: string) {
  let s = await twoGisSuggest(q);
  if ((!s || !s.length)) s = await twoGisGeocode(q);
  if ((!s || !s.length)) s = await nominatimSearch(q);
  return s || [];
}
