import { Context, session } from 'telegraf';
import type { Update } from 'telegraf/typings/core/types/typegram';

export interface VerifFile { kind: 'photo' | 'document'; file_id: string; mime?: string; caption?: string; }
export interface WaitReceipt { periodDays: number; amount: number; }

export interface ClientOrderSession {
  flow: 'client_order';
  type: 'TAXI' | 'DELIVERY';
  step: 'from' | 'to' | 'commentAsk' | 'commentWait' | 'confirm';
  await?: 'cli_from_2gis' | 'cli_to_2gis' | 'cli_from_geo' | 'cli_to_geo' | 'cli_from_manual' | 'cli_to_manual' | null;
  from_lat?: number; from_lon?: number; from_text?: string | null; from_url?: string | null;
  to_lat?: number; to_lon?: number; to_text?: string | null; to_url?: string | null;
  distance_km?: number | null; fare_fixed_tg?: number | null;
  comment_text?: string | null;
}

export interface SessionData {
  awaitingPhone?: boolean;
  verif?: { collecting: boolean; files: VerifFile[]; role: 'TAXI' | 'COURIER'; stepMsg?: number | null; };
  sub?: { waitReceipt?: WaitReceipt | null; };
  supportOpen?: boolean;
  lastClientPhone?: string | null;
  flow?: any; // ClientOrderSession
}

export type MyContext = Context<Update> & { session: SessionData | any };
