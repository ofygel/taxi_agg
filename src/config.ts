import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  TELEGRAM_WEBHOOK_DOMAIN: z.string().url().optional(),
  TELEGRAM_WEBHOOK_PATH: z.string().default('/tg'),
  DRIVERS_CHANNEL_ID: z.string().optional()
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid env:', parsed.error.flatten().fieldErrors);
  throw new Error('Missing/invalid environment variables');
}

export const env = parsed.data;

// --- Основные ENV ---
export const TELEGRAM_BOT_TOKEN     = env.TELEGRAM_BOT_TOKEN;
export const SUPABASE_URL           = env.SUPABASE_URL;
export const SUPABASE_ANON_KEY      = env.SUPABASE_ANON_KEY;
export const TELEGRAM_WEBHOOK_DOMAIN = env.TELEGRAM_WEBHOOK_DOMAIN;
export const TELEGRAM_WEBHOOK_PATH   = env.TELEGRAM_WEBHOOK_PATH;
export const DRIVERS_CHANNEL_ID      = env.DRIVERS_CHANNEL_ID;

export const IS_PROD = process.env.NODE_ENV === 'production';
export const PORT = Number(process.env.PORT) || 3000;

// --- Алиасы для совместимости ---
export const WEBHOOK_DOMAIN = TELEGRAM_WEBHOOK_DOMAIN;
export const WEBHOOK_PATH   = TELEGRAM_WEBHOOK_PATH;
export const BOT_TOKEN      = TELEGRAM_BOT_TOKEN;

// --- Пути в Supabase Storage ---
export const PDF_LOGO_PATH  = 'bot-assets/logo.png';
export const PDF_STAMP_PATH = 'bot-assets/stamp.png';
export const TUTORIAL_VIDEO_PATH = 'bot-assets/tutorial.mp4';
export const TUTORIAL_VIDEO_BUCKET = 'bot-assets';

// --- Supabase Storage ---
export const STORAGE_BUCKET = 'public';
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 дней
export const VERIFY_PHOTO_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 дней
export const SUBSCRIPTION_RECEIPT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 дней
export const ORDER_PHOTO_TTL_SECONDS = 60 * 60 * 24 * 30;
export const MEDIA_ASSETS_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 дней

// --- Прочее ---
export const MAX_ORDERS_PER_DRIVER = 3;
export const MAX_ORDERS_PER_CLIENT = 1;
export const MAX_DISTANCE_KM = 200; // максимально допустимое расстояние

// --- Тайминги ---
export const GEO_TTL_SECONDS = 90; // 1.5 минуты
export const TTL_INFO_MS = 60 * 1000; // 1 минута
export const BOT_COMMANDS_UPDATE_INTERVAL_MS = 60 * 60 * 1000; // 1 час

// --- Тарифы ---
export const BASE_TG = Number(process.env.BASE_TG) || 1000; // базовый тариф
export const KM_TG = Number(process.env.KM_TG) || 200; // цена за км
export const FREE_KM = Number(process.env.FREE_KM) || 1; // первые км бесплатны

// --- Старые алиасы (для совместимости) ---
export const BASE_FARE_MIN_TG = BASE_TG;
export const BASE_FARE_PER_KM_TG = KM_TG;
export const BASE_FARE_FREE_KM = FREE_KM;

// --- Гео-настройки ---
export const CITY_NAME = process.env.CITY_NAME || 'Алматы';
export const CITY_BOUNDS = process.env.CITY_BOUNDS || ''; // можно хранить как JSON или bbox
export const TWO_GIS_API_KEY = process.env.TWO_GIS_API_KEY || '';
export const TWO_GIS_OPEN_URL = 'https://2gis.kz';

// --- Подписки ---
export const SUB_PRICE_7  = Number(process.env.SUB_PRICE_7)  || 1000;
export const SUB_PRICE_15 = Number(process.env.SUB_PRICE_15) || 2000;
export const SUB_PRICE_30 = Number(process.env.SUB_PRICE_30) || 3000;
export const SUB_WARN_HOURS = Number(process.env.SUB_WARN_HOURS) || 24;

// --- Админы ---
export const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map(s => Number(s.trim()))
  .filter(n => !isNaN(n));

// --- Каналы ---
export const DRIVERS_CHANNEL_INVITE = process.env.DRIVERS_CHANNEL_INVITE || '';
