import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

/** Создаёт/обновляет пользователя в public.users по telegram_id */
export async function ensureUser(
  telegram_id: number,
  patch: Partial<{ phone: string; first_name: string; username: string; role: 'CLIENT'|'DRIVER'|'ADMIN' }> = {}
) {
  const { data, error } = await supabase
    .from('users')
    .upsert({ telegram_id, ...patch }, { onConflict: 'telegram_id' })
    .select()
    .single(); // без maybeSingle()
  if (error) throw error;
  return data;
}

/** Пример апсерта профиля, чтобы закрыть импорты из modules/verify.ts */
export async function upsertProfile(row: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'telegram_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
