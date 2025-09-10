// Node 18 совместимость
import fetch from 'node-fetch';

import { supabase } from '../supabase';
import { STORAGE_BUCKET, SIGNED_URL_TTL_SECONDS } from '../config';
import type { MyContext } from '../types';
import { bot } from '../bot';

export async function downloadTelegramFileUrl(file_id: string): Promise<string | null> {
  try {
    const link = await bot.telegram.getFileLink(file_id);
    return String(link);
  } catch (e) { console.error('getFileLink', e); return null; }
}

export async function uploadToStorage(prefix: string, fileName: string, data: ArrayBuffer, mime?: string) {
  const path = `${prefix}/${fileName}`;
  const { error } = await (supabase as any).storage.from(STORAGE_BUCKET)
    .upload(path, Buffer.from(data), { upsert: true, contentType: mime || 'application/octet-stream' });
  if (error) { console.error('storage.upload', error); return { path, url: null }; }
  let url: string | null = null;
  try {
    const { data: signed, error: e2 } = await (supabase as any).storage.from(STORAGE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (!e2) url = signed?.signedUrl || null;
  } catch { /* noop */ }
  return { path, url };
}

export async function saveTelegramFileToStorage(
  owner: number,
  kind: 'VERIFY'|'SUBSCRIPTION_RECEIPT'|'ORDER',
  file_id: string,
  mime?: string,
  meta: any = {}
) {
  const fileUrl = await downloadTelegramFileUrl(file_id);
  if (!fileUrl) return null;
  const resp = await fetch(fileUrl);
  const buf = await resp.arrayBuffer();
  const detectedMime = mime || resp.headers.get('content-type') || 'application/octet-stream';
  const ext = detectedMime.includes('jpeg') ? 'jpg' :
              detectedMime.includes('png') ? 'png' :
              detectedMime.includes('pdf') ? 'pdf' :
              detectedMime.includes('webp') ? 'webp' : 'bin';
  const ts = Date.now();
  const { path, url } = await uploadToStorage(kind.toLowerCase(), `${owner}/${ts}.${ext}`, buf, detectedMime);
  await supabase.from('media_assets').insert({
    owner_telegram_id: owner, kind, file_path: path, file_url: url, mime: detectedMime, meta
  });
  return { path, url, mime: detectedMime };
}

export async function getStorageBuffer(path?: string | null) {
  if (!path) return null;
  try {
    const { data, error } = await (supabase as any).storage.from(STORAGE_BUCKET).download(path);
    if (error || !data) return null;
    const arr = await data.arrayBuffer();
    return Buffer.from(arr);
  } catch { return null; }
}
