import { Context } from 'telegraf';

export type Role = 'CLIENT' | 'DRIVER' | 'ADMIN';

export interface SessionData {
  role?: Role;
  state?: string;
  [k: string]: unknown;
}

/**
 * Наша обёртка над базовым Context.
 * НИЧЕГО не меняем в полях Telegraf, чтобы NarrowedContext был совместим.
 */
export type MyContext = Context & {
  session?: SessionData;
  state: Record<string, unknown>;
};
