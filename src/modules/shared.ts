import type { MyContext } from '../types';
import { supabase, singleOrNull } from '../supabase';

export async function ensureUser(ctx: MyContext) {
  const u = ctx.from; if (!u) return null;
  const sel = await singleOrNull<any>(supabase.from('users').select('*').eq('telegram_id', u.id));
  if (sel.error) { console.error('ensureUser.select', sel.error); return null; }
  if (sel.data) return sel.data;
  const ins = await supabase.from('users').insert({
    telegram_id: u.id, role: null, phone: null, first_name: (u as any).first_name || null, username: (u as any).username || null
  }).select('*').single();
  if (ins.error) { console.error('ensureUser.insert', ins.error); return null; }
  return ins.data;
}

export async function setUserRole(uid: number, role: 'CLIENT' | 'DRIVER' | 'ADMIN') {
  return supabase.from('users').update({ role }).eq('telegram_id', uid);
}
export async function upsertProfile(uid: number, patch: Record<string, any>) {
  return supabase.from('driver_profiles').upsert({ user_telegram_id: uid, ...patch }, { onConflict: 'user_telegram_id' });
}
