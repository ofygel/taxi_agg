import { Markup } from 'telegraf';
import type { MyContext } from '../types';
import { bot } from '../bot';
import { ensureUser } from './shared';

const kbHome = () => Markup.inlineKeyboard([
  [Markup.button.callback('🧍 Клиент', 'role_client')],
  [Markup.button.callback('🚖 Водитель такси', 'role_driver_taxi')],
  [Markup.button.callback('📦 Курьер', 'role_courier')],
  [Markup.button.callback('🆘 Поддержка', 'support')],
  [Markup.button.callback('🧰 Кабинет', 'cabinet')]
]);

export const kbBackHome = () => Markup.inlineKeyboard([[Markup.button.callback('🔙 На главную', 'go_home')]]);

export async function showHome(ctx: MyContext, note?: string) {
  const me = await ensureUser(ctx);
  const role = me?.role || null;
  const msg = [
    note ? `ℹ️ ${note}` : null,
    'Выберите роль:',
    role ? `Текущая роль: <b>${role}</b>` : 'Роль пока не выбрана.'
  ].filter(Boolean).join('\n');
  return ctx.reply(msg, { parse_mode: 'HTML', ...kbHome() });
}

export function installHome() {
  bot.start(async (ctx) => { await ensureUser(ctx); ctx.session = {}; return showHome(ctx); });
  bot.action('go_home', async (ctx) => { await ctx.answerCbQuery(); ctx.session = {}; try { await (ctx as any).deleteMessage?.(); } catch { } return showHome(ctx, 'Ок.'); });
}
