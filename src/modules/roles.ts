import { Markup } from 'telegraf';
import type { MyContext } from '../types';
import { bot } from '../bot';
import { setUserRole, upsertProfile } from './shared';
import { ensurePhone } from './user_phone';

export function installRoles() {
  bot.action('role_client', async (ctx) => {
    await ctx.answerCbQuery();
    if (!await ensurePhone(ctx)) return;
    await setUserRole(ctx.from!.id, 'CLIENT');
    try { await (ctx as any).deleteMessage?.(); } catch { }
    return ctx.reply('Роль: Клиент.\nВыберите:', Markup.inlineKeyboard([
      [Markup.button.callback('🚕 Заказать женское такси', 'cli_taxi')],
      [Markup.button.callback('📦 Заказать доставку', 'cli_deliv')],
      [Markup.button.callback('🔙 На главную', 'go_home')]
    ]));
  });

  bot.action('role_driver_taxi', async (ctx) => {
    await ctx.answerCbQuery();
    if (!await ensurePhone(ctx)) return;
    await setUserRole(ctx.from!.id, 'DRIVER');
    await upsertProfile(ctx.from!.id, { actor_role: 'TAXI' });
    try { await (ctx as any).deleteMessage?.(); } catch { }
    return ctx.reply(
      'Роль: Исполнитель (такси). Продолжим верификацию.',
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Пройти проверку', 'drv_verify')],
        [Markup.button.callback('🔙 На главную', 'go_home')]
      ])
    );
  });

  bot.action('role_courier', async (ctx) => {
    await ctx.answerCbQuery();
    if (!await ensurePhone(ctx)) return;
    await setUserRole(ctx.from!.id, 'DRIVER');
    await upsertProfile(ctx.from!.id, { actor_role: 'COURIER' });
    try { await (ctx as any).deleteMessage?.(); } catch { }
    return ctx.reply(
      'Роль: Исполнитель (курьер). Продолжим верификацию.',
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Пройти проверку', 'drv_verify')],
        [Markup.button.callback('🔙 На главную', 'go_home')]
      ])
    );
  });
}
