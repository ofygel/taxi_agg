import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  DRIVERS_CHANNEL_INVITE
} from './config';
import type { Role, VerifyStatus, VerifFile } from './types';

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

export function tgId(ctx: any): number {
  const id = ctx.from?.id;
  if (typeof id !== 'number') throw new Error('telegram_id missing');
  return id;
}

export async function ensureUser(
  telegram_id: number,
  patch: Partial<{
    phone: string;
    first_name: string;
    username: string;
    role: Role;
    verify_status: VerifyStatus;
  }> = {}
) {
  const { data, error } = await supabase
    .from('users')
    .upsert({ telegram_id, ...patch }, { onConflict: 'telegram_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Шим для старого импорта
export async function ensureUserFromCtx(ctx: any, patch?: any) {
  return ensureUser(tgId(ctx), patch);
}

export async function upsertProfile(row: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'telegram_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .limit(1);
  if (error) throw error;
  return data?.[0]?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}

export async function createVerification(
  telegram_id: number,
  role: Role,
  files: VerifFile[]
) {
  const { data, error } = await supabase
    .from('verifications')
    .insert({ telegram_id, role, status: 'PENDING', files })
    .select()
    .single();
  if (error) throw error;
  await ensureUser(telegram_id, { role, verify_status: 'PENDING' });
  return data;
}

export async function setVerificationStatus(
  telegram_id: number,
  status: VerifyStatus,
  reason?: string
) {
  const { error } = await supabase
    .from('verifications')
    .update({ status, reason })
    .eq('telegram_id', telegram_id)
    .eq('status', 'PENDING');
  if (error) throw error;
  await ensureUser(telegram_id, { verify_status: status as VerifyStatus });
}

export interface Subscription {
  telegram_id: number;
  until_ts: string;
  plan_days: number;
}

export async function openAccess(telegram_id: number, planDays: number) {
  const until = new Date(Date.now() + planDays * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(
      { telegram_id, until_ts: until, plan_days: planDays },
      { onConflict: 'telegram_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Subscription;
}

export async function getSubscription(telegram_id: number) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('telegram_id', telegram_id)
    .limit(1);
  if (error) throw error;
  return data && data[0] ? (data[0] as Subscription) : null;
}

export async function saveReceipt(
  telegram_id: number,
  plan_days: number,
  file: VerifFile
) {
  const { error } = await supabase
    .from('receipts')
    .insert({ telegram_id, plan_days, file });
  if (error) throw error;
}

export function inviteButtonUrl(): string | null {
  return DRIVERS_CHANNEL_INVITE ?? null;
}

// ===== Заказы =====
export interface OrderInput {
  client_id: number;
  kind: 'TAXI' | 'DELIVERY';
  from_text?: string;
  from_lat?: number;
  from_lon?: number;
  to_text?: string;
  to_lat?: number;
  to_lon?: number;
  comment_text?: string;
  price_estimate?: number;
}

export interface OrderRow extends OrderInput {
  id: number;
  status: 'NEW' | 'TAKEN' | 'CANCELLED' | 'DONE';
  driver_id?: number | null;
  channel_msg_id?: number | null;
  created_at?: string;
}

export async function createOrder(input: OrderInput): Promise<OrderRow> {
  const { data, error } = await supabase
    .from('orders')
    .insert({ ...input, status: 'NEW' })
    .select()
    .single();
  if (error) throw error;
  return data as OrderRow;
}

export async function setOrderChannelMsg(
  orderId: number,
  messageId: number
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ channel_msg_id: messageId })
    .eq('id', orderId);
  if (error) throw error;
}

export async function tryTakeOrder(
  orderId: number,
  driverId: number
): Promise<OrderRow | null> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'TAKEN', driver_id: driverId })
    .eq('id', orderId)
    .eq('status', 'NEW')
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as OrderRow) ?? null;
}
