import { Telegraf, type Context, Markup } from 'telegraf';
import type { ClientOrderSession } from '@/types';
import { ensureSession, sendReplacing, mapButtons } from '@/shared';
import { parseMapLink, haversineKm } from '@/geo';
import { createOrder } from '@/supabase';

function warnManualAddress(kind: 'TAXI' | 'DELIVERY') {
  const extra =
    kind === 'DELIVERY'
      ? '\nДля доставки укажите детали: телефон получателя, блок/подъезд/этаж/квартира.'
      : '';
  return (
    'Рекомендуем указывать локацию или ссылку — чтобы исключить дубликаты адресов в других городах.' +
    extra
  );
}

export function register(bot: Telegraf<Context>) {
  bot.hears('🚕 Заказать такси', async (ctx: Context) => {
    const s = ensureSession(ctx);
    s.order = { step: 'WAIT_FROM', kind: 'TAXI' };
    await sendReplacing(
      ctx,
      'Откуда забрать?',
      Markup.keyboard([
        [{ text: '📍 Отправить локацию', request_location: true }],
        [
          { text: 'Ввести адрес вручную' },
          { text: 'Вставить ссылку 2ГИС/Навигатор' }
        ],
        [{ text: 'На главную' }]
      ]).resize()
    );
  });

  bot.hears('📦 Заказать доставку', async (ctx: Context) => {
    const s = ensureSession(ctx);
    s.order = { step: 'WAIT_FROM', kind: 'DELIVERY' };
    await sendReplacing(
      ctx,
      'Откуда забрать? (доставка)',
      Markup.keyboard([
        [{ text: '📍 Отправить локацию', request_location: true }],
        [
          { text: 'Ввести адрес вручную' },
          { text: 'Вставить ссылку 2ГИС/Навигатор' }
        ],
        [{ text: 'На главную' }]
      ]).resize()
    );
  });

  bot.hears('Ввести адрес вручную', async (ctx: Context) => {
    const s = ensureSession(ctx);
    const o: ClientOrderSession = s.order ?? { step: 'IDLE' };
    if (o.step === 'IDLE') return;
    await sendReplacing(ctx, warnManualAddress(o.kind ?? 'TAXI'));
  });

  bot.hears('Вставить ссылку 2ГИС/Навигатор', async (ctx: Context) => {
    await sendReplacing(ctx, 'Вставьте ссылку — я извлеку координаты.');
  });

  bot.on('location', async (ctx: Context) => {
    const s = ensureSession(ctx);
    const o: ClientOrderSession = s.order ?? { step: 'IDLE' };
    const m = ctx.message;
    if (!m || !('location' in m) || !m.location) return;

    const lat = m.location.latitude;
    const lon = m.location.longitude;

    if (o.step === 'WAIT_FROM') {
      o.from_lat = lat;
      o.from_lon = lon;
      o.from_text = 'Точка отправления';
      o.step = 'WAIT_TO';
      s.order = o;
      await sendReplacing(
        ctx,
        'Куда ехать?',
        Markup.keyboard([
          [{ text: '📍 Отправить локацию', request_location: true }],
          [
            { text: 'Ввести адрес вручную' },
            { text: 'Вставить ссылку 2ГИС/Навигатор' }
          ],
          [{ text: 'На главную' }]
        ]).resize()
      );
      return;
    }

    if (o.step === 'WAIT_TO') {
      o.to_lat = lat;
      o.to_lon = lon;
      o.to_text = 'Точка назначения';
      if (o.from_lat && o.from_lon) {
        const dist = haversineKm(
          { lat: o.from_lat, lon: o.from_lon },
          { lat: o.to_lat!, lon: o.to_lon! }
        );
        o.distance_km = Math.round(dist * 10) / 10;
        o.price_estimate = Math.max(500, Math.round(500 + 150 * dist));
      }
      o.step = 'ASK_COMMENT';
      s.order = o;
      const kb = mapButtons({ lat: o.to_lat!, lon: o.to_lon! }, o.to_text);
      await sendReplacing(
        ctx,
        `Хотите оставить комментарий для ${
          o.kind === 'DELIVERY' ? 'курьера' : 'водителя'
        }?`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('Да', 'cl_cmt_yes'),
            Markup.button.callback('Нет', 'cl_cmt_no')
          ]
        ])
      );
      await ctx.reply('Быстрые ссылки:', kb);
      return;
    }
  });

  bot.on('text', async (ctx: Context) => {
    const s = ensureSession(ctx);
    const o: ClientOrderSession = s.order ?? { step: 'IDLE' };
    const m = ctx.message;
    if (!m || !('text' in m)) return;
    const t = m.text;

    if (o.step === 'WAIT_FROM') {
      const mm = parseMapLink(t);
      if (mm) {
        o.from_lat = mm.lat;
        o.from_lon = mm.lon;
        o.from_text = mm.label ?? 'Точка отправления';
      } else {
        o.from_text = t;
      }
      o.step = 'WAIT_TO';
      s.order = o;
      await sendReplacing(ctx, 'Куда ехать?');
      return;
    }

    if (o.step === 'WAIT_TO') {
      const mm = parseMapLink(t);
      if (mm) {
        o.to_lat = mm.lat;
        o.to_lon = mm.lon;
        o.to_text = mm.label ?? 'Точка назначения';
      } else {
        o.to_text = t;
      }
      if (o.from_lat && o.from_lon && o.to_lat && o.to_lon) {
        const dist = haversineKm(
          { lat: o.from_lat, lon: o.from_lon },
          { lat: o.to_lat, lon: o.to_lon }
        );
        o.distance_km = Math.round(dist * 10) / 10;
        o.price_estimate = Math.max(500, Math.round(500 + 150 * dist));
      }
      o.step = 'ASK_COMMENT';
      s.order = o;
      await sendReplacing(
        ctx,
        `Хотите оставить комментарий для ${
          o.kind === 'DELIVERY' ? 'курьера' : 'водителя'
        }?`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('Да', 'cl_cmt_yes'),
            Markup.button.callback('Нет', 'cl_cmt_no')
          ]
        ])
      );
      return;
    }

    if (o.step === 'ASK_COMMENT') {
      o.comment_text = t;
      o.step = 'CONFIRM';
      s.order = o;
      await sendConfirm(ctx, o);
      return;
    }
  });

  bot.action('cl_cmt_yes', async (ctx: Context) => {
    await ctx.answerCbQuery();
    await sendReplacing(ctx, 'Напишите комментарий:');
    const s = ensureSession(ctx);
    const o = s.order;
    if (!o) return;
    o.step = 'ASK_COMMENT';
    s.order = o;
  });

  bot.action('cl_cmt_no', async (ctx: Context) => {
    await ctx.answerCbQuery();
    const s = ensureSession(ctx);
    const o = s.order;
    if (!o) return;
    o.comment_text = undefined;
    o.step = 'CONFIRM';
    s.order = o;
    await sendConfirm(ctx, o);
  });

  async function sendConfirm(ctx: Context, o: ClientOrderSession) {
    const summary = `Проверьте заказ:
Откуда: ${o.from_text ?? '(нет)'}
Куда: ${o.to_text ?? '(нет)'}
Комментарий: ${o.comment_text ?? '—'}
Оценочная стоимость: ${o.price_estimate ? `${o.price_estimate} ₸` : '—'}
Всё верно?`;
    await sendReplacing(
      ctx,
      summary,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Да', 'cl_ok')],
        [Markup.button.callback('❌ Нет, начать заново', 'cl_restart')]
      ])
    );
  }

  bot.action('cl_restart', async (ctx: Context) => {
    await ctx.answerCbQuery();
    const s = ensureSession(ctx);
    s.order = { step: 'WAIT_FROM', kind: s.order?.kind ?? 'TAXI' };
    await sendReplacing(ctx, 'Начинаем заново. Откуда забрать?');
  });

  bot.action('cl_ok', async (ctx: Context) => {
    await ctx.answerCbQuery();
    const s = ensureSession(ctx);
    const o = s.order;
    if (!o) return;

    const created = await createOrder({
      client_id: (ctx.from as any).id,
      kind: o.kind ?? 'TAXI',
      from_text: o.from_text,
      from_lat: o.from_lat,
      from_lon: o.from_lon,
      to_text: o.to_text,
      to_lat: o.to_lat,
      to_lon: o.to_lon,
      comment_text: o.comment_text,
      price_estimate: o.price_estimate ?? undefined
    });

    (ctx as any).state = { createdOrderId: created.id };
    s.order = { step: 'IDLE' };
    await sendReplacing(ctx, 'Заказ сформирован. Ожидайте исполнителя.');
  });
}
