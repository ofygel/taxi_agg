import 'dotenv/config';
import { bot } from '@/bot';

// модули
import * as home         from '@/modules/home';
import * as roles        from '@/modules/roles';
import * as phone        from '@/modules/phone';
import * as verification from '@/modules/verification';
import * as subscription from '@/modules/subscription';
import * as support      from '@/modules/support';
import * as orders       from '@/modules/orders';
import * as client_flow  from '@/modules/client_flow';
import * as admin        from '@/modules/admin';

// регистрация
[home, roles, phone, verification, subscription, support, orders, client_flow, admin]
  .forEach((m: any) => typeof m.register === 'function' && m.register(bot));

// периодические задачи: напоминание о продлении/кик (каждые 30 мин; для реального кика нужен supergroup)
import { supabase, getSubscription } from '@/supabase';
import { getSetting } from '@/supabase';

setInterval(async () => {
  const chan = await getSetting('drivers_channel_id');
  if (!chan) return;
  const { data, error } = await supabase.from('subscriptions').select('*');
  if (error || !data) return;
  const now = Date.now();

  for (const s of data) {
    const until = Date.parse(s.until_ts);
    if (Number.isNaN(until)) continue;
    const uid = s.telegram_id as number;
    const left = until - now;
    if (left < 0) {
      // срок истёк — предупредим и «кикнем» (для каналов может не сработать, для супергрупп — да)
      try {
        await bot.telegram.sendMessage(uid, 'Подписка истекла. Продлите, чтобы продолжить получать заказы.');
        await bot.telegram.banChatMember(Number(chan), uid).catch(()=>{});
        await bot.telegram.unbanChatMember(Number(chan), uid, { only_if_banned: true }).catch(()=>{});
      } catch {}
    } else if (left < 12 * 3600 * 1000) {
      // осталось менее 12 часов — напоминание
      try { await bot.telegram.sendMessage(uid, 'Подписка скоро истечёт (менее 12 часов). Не забудьте продлить.'); } catch {}
    }
  }
}, 30 * 60 * 1000);

bot.launch();
process.once('SIGINT',  () => {});
process.once('SIGTERM', () => {});
