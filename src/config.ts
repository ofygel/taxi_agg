import 'dotenv/config';

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
if (!BOT_TOKEN) { console.error('TELEGRAM_BOT_TOKEN is required'); process.exit(1); }

export const SUPABASE_URL = process.env.SUPABASE_URL!;
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('SUPABASE creds required'); process.exit(1); }

export const IS_PROD = !!process.env.RAILWAY_PROJECT_ID || process.env.NODE_ENV === 'production';
export const WEBHOOK_DOMAIN = (process.env.TELEGRAM_WEBHOOK_DOMAIN || '').trim();
export const WEBHOOK_PATH = process.env.TELEGRAM_WEBHOOK_PATH || '/tg';
export const PORT = Number(process.env.PORT || 8080);

export const ADMIN_IDS = String(process.env.ADMIN_TG_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean)
  .map(v => Number(v)).filter(Number.isFinite);

export const BASE_TG = Number(process.env.BASE_FARE_MIN_TG || 1000);
export const KM_TG = Number(process.env.BASE_KM_TG || 250);
export const FREE_KM = Number(process.env.FREE_KM || 1);

export const DRIVERS_CHANNEL_INVITE = (process.env.DRIVERS_CHANNEL_INVITE || '').trim();
export const TWO_GIS_OPEN_URL = process.env.TWO_GIS_OPEN_URL || 'https://2gis.kz/almaty';

export const TWO_GIS_API_KEY = (process.env.TWO_GIS_API_KEY || '').trim();
export const CITY_NAME = process.env.CITY_NAME || 'Алматы';
export const CITY_BOUNDS = process.env.CITY_BOUNDS || '76.70,43.00;77.20,43.40';

export const SUB_PRICE_7 = Number(process.env.SUB_PRICE_7 || 3000);
export const SUB_PRICE_15 = Number(process.env.SUB_PRICE_15 || 5000);
export const SUB_PRICE_30 = Number(process.env.SUB_PRICE_30 || 10000);
export const SUB_WARN_HOURS = Number(process.env.SUB_WARN_HOURS || 12);

export const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'bot-assets';
export const PDF_LOGO_PATH = process.env.PDF_LOGO_PATH || 'branding/logo.png';
export const PDF_STAMP_PATH = process.env.PDF_STAMP_PATH || 'branding/stamp.png';
export const SIGNED_URL_TTL_SECONDS = Number(process.env.SIGNED_URL_TTL_SECONDS || 604800);

export const TTL_INFO_MS = Number(process.env.TTL_INFO_MS || 60_000);
