import { createClient, PostgrestError } from '@supabase/supabase-js';
import { SERVICE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

/** Обёртка над .single() — возвращает { data:null } при PGRST116 (record not found) */
export async function singleOrNull<T>(qb: any): Promise<{ data: T | null, error: PostgrestError | null }> {
  const { data, error } = await qb.single();
  if (error && (error as any).code === 'PGRST116') return { data: null, error: null };
  return { data, error };
}

/** helpers for app_settings */
export async function getSetting(key: string): Promise<string> {
  const { data, error } = await singleOrNull<{ value: string }>(
    supabase.from('app_settings').select('value').eq('key', key)
  );
  if (error) { console.error('getSetting', key, error); return ''; }
  return data?.value || '';
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert({ key, value });
  if (error) console.error('setSetting', key, error);
}
