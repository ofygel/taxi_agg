import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),

  TELEGRAM_WEBHOOK_DOMAIN: z.string().url().optional(),
  TELEGRAM_WEBHOOK_PATH: z.string().default('/tg'),

  DRIVERS_CHANNEL_INVITE: z.string().url().optional(),
  STORAGE_BUCKET: z.string().optional(),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().optional(),
  ADMIN_IDS: z.string().optional(),
  BASE_TG: z.coerce.number().optional(),
  KM_TG: z.coerce.number().optional(),
  FREE_KM: z.coerce.number().optional(),
  TWO_GIS_OPEN_URL: z.string().optional(),
  TTL_INFO_MS: z.coerce.number().optional(),
  PDF_LOGO_PATH: z.string().optional(),
  PDF_STAMP_PATH: z.string().optional()
});

const env = schema.parse(process.env);

export const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
export const SUPABASE_URL = env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

export const TELEGRAM_WEBHOOK_DOMAIN = env.TELEGRAM_WEBHOOK_DOMAIN;
export const TELEGRAM_WEBHOOK_PATH = env.TELEGRAM_WEBHOOK_PATH;

export const DRIVERS_CHANNEL_INVITE = env.DRIVERS_CHANNEL_INVITE ?? null;

export const STORAGE_BUCKET = env.STORAGE_BUCKET ?? 'files';
export const SIGNED_URL_TTL_SECONDS = env.SIGNED_URL_TTL_SECONDS ?? 3600;

export const ADMIN_IDS = (env.ADMIN_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => Number(s))
  .filter((n) => Number.isFinite(n));

export const BASE_TG = env.BASE_TG ?? 500;
export const KM_TG = env.KM_TG ?? 150;
export const FREE_KM = env.FREE_KM ?? 0;
export const TWO_GIS_OPEN_URL = env.TWO_GIS_OPEN_URL ?? 'https://go.2gis.com';
export const TTL_INFO_MS = env.TTL_INFO_MS ?? 10 * 60 * 1000;

export const PDF_LOGO_PATH = env.PDF_LOGO_PATH ?? '';
export const PDF_STAMP_PATH = env.PDF_STAMP_PATH ?? '';
