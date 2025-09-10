import type { Context } from 'telegraf';

// Доменные типы

export type Role = 'DRIVER' | 'COURIER' | 'CLIENT';
export type VerifyStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface VerifFile {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  size?: number;
}

export type OrderKind = 'TAXI' | 'DELIVERY';

export type OrderStep =
  | 'IDLE'
  | 'WAIT_FROM'
  | 'WAIT_TO'
  | 'ASK_COMMENT'
  | 'CONFIRM';

export interface ClientOrderSession {
  step: OrderStep;
  kind?: OrderKind;

  from_text?: string;
  from_lat?: number;
  from_lon?: number;

  to_text?: string;
  to_lat?: number;
  to_lon?: number;

  distance_km?: number;
  price_estimate?: number;

  comment_text?: string;
}

export interface SessionData {
  order?: ClientOrderSession;

  // для загрузки файлов (верификация/чеки)
  collecting?: boolean;
  files?: VerifFile[];

  // выбранная роль (для инструкций)
  role?: Role;

  // вспомогательные поля
  supportThreadId?: number;
  _lastMessageId?: number;
}

// Тип контекста бота, который ожидают некоторые модули
export type MyContext = Context & { session?: SessionData };
