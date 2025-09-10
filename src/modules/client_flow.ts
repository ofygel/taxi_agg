// src/modules/client_flow.ts
import { Composer, Markup, Telegraf } from 'telegraf';
import type { MyContext, ClientOrderSession } from '../types';
import { supabase } from '../supabase';
import { getSetting } from './settings';
import {
  sendEphemeral,
  replaceWith,
  calcFare,
  twoGisOpenLink,
  parse2gis,
  geocodeSuggest,
  b64,
  ub64,
} from './helpers';
import {
  CITY_NAME,
  TWO_GIS_OPEN_URL,
  TTL_INFO_MS,
} from '../config';

/**
 * Клавиатуры
 */
const kbBackHome = () =>
  Markup.inlineKeyboard([[Markup.button.callback('🔙 На главную', 'go_home')]]);

/**
 * Локальные утилиты
 */
const isNotFound = (e: any) => e?.code === 'PGRST116';

function askPointB(ctx: MyContext) {
  return ctx.reply(
    'Теперь точка Б (доставить/привезти):',
    Markup.inlineKeyboard([
      [Markup.button.callback('🔗 2ГИС-ссылка', 'cli_to_2gis')],
      [Markup.button.callback('📍 Геолокация', 'cli_to_geo')],
      [Markup.button.callback('⌨️ Ввести адрес вручную', 'cli_to_manual')],
      [Markup.button.callback('🔙 На главную', 'go_home')],
    ]),
  );
}

async function afterAB(ctx: MyContext) {
  const s = ctx.session as ClientOrderSession;
  if (s.from_lat && s.from_lon && s.to_lat && s.to_lon) {
    const { distKm, fare } = calcFare(
      s.from_lat,
      s.from_lon,
      s.to_lat,
      s.to_lon,
    );
    s.distance_km = distKm;
    s.fare_fixed_tg = fare;
  } else {
    s.distance_km = null;
    s.fare_fixed_tg = null;
  }

  s.step = 'commentAsk';
  const needComment = s.type === 'DELIVERY';
  const kb = needComment
    ? Markup.inlineKeyboard([
        [Markup.button.callback('✍️ Ввести комментарий', 'cli_comment_yes')],
        [Markup.button.callback('🔙 На главную', 'go_home')],
      ])
    : Markup.inlineKeyboard([
        [
          Markup.button.callback('Да', 'cli_comment_yes'),
          Markup.button.callback('Нет', 'cli_comment_no'),
        ],
        [Markup.button.callback('🔙 На главную', 'go_home')],
      ]);

  const msg = needComment
    ? 'Для доставки комментарий обязателен: укажите телефон получателя, подъезд/этаж/кв и т.п.'
    : 'Оставить комментарий водителю?';

  return ctx.reply(msg, kb);
}

async function confirmOrder(ctx: MyContext) {
  const s = ctx.session as ClientOrderSession;
  s.step = 'confirm';

  const lines: string[] = [];
  lines.push(`Тип: ${s.type === 'TAXI' ? 'Такси' : 'Доставка'}`);
  lines.push(`Откуда: ${s.from_text || '-'}`);
  lines.push(`Куда: ${s.to_text || '-'}`);
  if (s.distance_km) lines.push(`Дистанция: ~${s.distance_km.toFixed(1)} км`);
  if (s.fare_fixed_tg) lines.push(`Фикс-цена: ${s.fare_fixed_tg} тг`);
  if (s.comment_text) lines.push(`Комментарий: ${s.comment_text}`);
  lines.push('Всё верно?');

  return ctx.reply(
    lines.join('\n'),
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Да, оформить', 'cli_make_order'),
        Markup.button.callback('❌ Нет, сначала', 'go_home'),
      ],
      [Markup.button.callback('🔙 На главную', 'go_home')],
    ]),
  );
}

/**
 * Рассылка заказа онлайн-исполнителям (в ЛС)
 * (фильтрация по роли, статусу, подписке)
 */
async function pushOrderToOnline(bot: Telegraf<MyContext>, order: any, captionHtml: string) {
  try {
    const { data: profs, error } = await supabase
      .from('driver_profiles')
      .select('user_telegram_id,is_online,status,subscription_expires_at,actor_role');

    if (error) throw error;

    const active = (profs || []).filter(
      (p: any) =>
        p.is_online &&
        p.status === 'APPROVED' &&
        (!p.subscription_expires_at ||
          new Date(p.subscription_expires_at) > new Date()) &&
        ((order.type === 'TAXI' && p.actor_role === 'TAXI') ||
          (order.type === 'DELIVERY' && p.actor_role === 'COURIER')),
    );

    for (const p of active) {
      try {
        await bot.telegram.sendMessage(p.user_telegram_id, captionHtml, {
          parse_mode: 'HTML',
        });
      } catch {
        // ignore
      }
    }
  } catch (e) {
    console.error('pushOrderToOnline', e);
  }
}

/**
 * Регистрируем клиентский флоу в виде изолированного Composer,
 * чтобы не конфликтовать с остальными обработчиками в проекте.
 */
export function registerClientFlow(bot: Telegraf<MyContext>) {
  const composer = new Composer<MyContext>();

  // Выбор типа (такси)
  composer.action('cli_taxi', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session = { flow: 'client_order', type: 'TAXI', step: 'from' } as ClientOrderSession;
    try {
      await (ctx as any).deleteMessage?.();
    } catch {}
    await ctx.reply(
      'Точка А: выберите способ:\n— 2ГИС-ссылка\n— Геолокация\n— Ввести вручную (лучше выбрать из подсказок 2ГИС)',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔗 2ГИС-ссылка', 'cli_from_2gis')],
        [Markup.button.callback('📍 Геолокация', 'cli_from_geo')],
        [Markup.button.callback('⌨️ Ввести адрес вручную', 'cli_from_manual')],
        [Markup.button.callback('🔙 На главную', 'go_home')],
      ]),
    );
  });

  // Выбор типа (доставка)
  composer.action('cli_deliv', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session = { flow: 'client_order', type: 'DELIVERY', step: 'from' } as ClientOrderSession;
    try {
      await (ctx as any).deleteMessage?.();
    } catch {}
    await ctx.reply(
      'Точка А (забрать): выберите способ:',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔗 2ГИС-ссылка', 'cli_from_2gis')],
        [Markup.button.callback('📍 Геолокация', 'cli_from_geo')],
        [Markup.button.callback('⌨️ Ввести адрес вручную', 'cli_from_manual')],
        [Markup.button.callback('🔙 На главную', 'go_home')],
      ]),
    );
  });

  // Переключатели способа ввода для A/B
  composer.action(
    [
      'cli_from_2gis',
      'cli_to_2gis',
      'cli_from_geo',
      'cli_to_geo',
      'cli_from_manual',
      'cli_to_manual',
    ],
    async (ctx) => {
      await ctx.answerCbQuery();
      const s = (ctx.session || {}) as ClientOrderSession;
      if (!s.flow || s.flow !== 'client_order')
        return replaceWith(ctx, 'Сессия заказа не активна.', kbBackHome());

      s.await = (ctx.match as any)[0] as any;
      return replaceWith(
        ctx,
        'Ок, пришлите данные одним сообщением.\nЕсли «вручную» — я предложу варианты 2ГИС.',
        kbBackHome(),
      );
    },
  );

  // Геолокация
  composer.on('location', async (ctx, next) => {
    const s = (ctx.session || {}) as ClientOrderSession;
    if (s.flow !== 'client_order' || !s.await) return next();

    const loc = (ctx.message as any).location;
    if (!loc) return next();

    if (/from_/.test(String(s.await))) {
      s.from_lat = loc.latitude;
      s.from_lon = loc.longitude;
      s.from_text = 'Точка А (гео)';
      s.from_url = twoGisOpenLink(s.from_lat, s.from_lon);
      s.step = 'to';
      s.await = null;
      await sendEphemeral(ctx, 'A принята.', {}, 1500);
      return askPointB(ctx);
    } else {
      s.to_lat = loc.latitude;
      s.to_lon = loc.longitude;
      s.to_text = 'Точка Б (гео)';
      s.to_url = twoGisOpenLink(s.to_lat, s.to_lon);
      s.await = null;
      return afterAB(ctx);
    }
  });

  // Текст (2ГИС-ссылка / ручной ввод + подсказки) + комментарий
  composer.on('text', async (ctx, next) => {
    const s = (ctx.session || {}) as ClientOrderSession;

    // 1) Комментарий
    if (s?.flow === 'client_order' && s.step === 'commentWait') {
      s.comment_text = (ctx.message as any).text?.trim();
      return confirmOrder(ctx);
    }

    // 2) Ввод A/B
    if (s.flow === 'client_order' && s.await) {
      const txt = (ctx.message as any).text?.trim() || '';

      if (/_2gis$/.test(String(s.await))) {
        const p = parse2gis(txt);
        if (!p)
          return sendEphemeral(
            ctx,
            'Это не похоже на 2ГИС-ссылку. Пришлите корректную.',
            {},
            TTL_INFO_MS,
          );

        if (/from_/.test(String(s.await))) {
          s.from_lat = p.lat;
          s.from_lon = p.lon;
          s.from_text = p.label;
          s.from_url = txt;
          s.step = 'to';
          s.await = null;
          await sendEphemeral(ctx, 'A принята.', {}, 1500);
          return askPointB(ctx);
        } else {
          s.to_lat = p.lat;
          s.to_lon = p.lon;
          s.to_text = p.label;
          s.to_url = txt;
          s.await = null;
          return afterAB(ctx);
        }
      }

      if (/manual$/.test(String(s.await))) {
        const suggestions = await geocodeSuggest(txt);
        if (suggestions.length) {
          const lines = suggestions
            .map((it, i) => `${i + 1}. ${it.label}`)
            .join('\n');
          const rows = suggestions.map((it, i) => [
            Markup.button.callback(
              `${i + 1}`,
              `geo_pick:${/from_/.test(String(s.await)) ? 'from' : 'to'}:${
                it.lat
              }:${it.lon}:${b64(it.label)}`,
            ),
          ]);
          await ctx.reply(
            `Нашёл варианты в ${CITY_NAME}:\n${lines}\nВыберите цифру:`,
            Markup.inlineKeyboard([
              ...rows,
              [Markup.button.callback('🔙 На главную', 'go_home')],
            ]),
          );
        } else {
          await sendEphemeral(
            ctx,
            'Подсказок нет. Сохраню как текст (может быть дубликат).',
            {},
            4000,
          );
          if (/from_/.test(String(s.await))) {
            s.from_text = txt;
            s.from_url = null;
            s.step = 'to';
            s.await = null;
            return askPointB(ctx);
          } else {
            s.to_text = txt;
            s.to_url = null;
            s.await = null;
            return afterAB(ctx);
          }
        }
        return;
      }
    }

    return next();
  });

  // Выбор адреса из подсказок
  composer.action(/geo_pick:(from|to):([^:]+):([^:]+):(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const kind = (ctx.match as any)[1] as 'from' | 'to';
    const lat = Number((ctx.match as any)[2]);
    const lon = Number((ctx.match as any)[3]);
    const label = ub64((ctx.match as any)[4]);
    const s = ctx.session as ClientOrderSession;

    if (kind === 'from') {
      s.from_lat = lat;
      s.from_lon = lon;
      s.from_text = label;
      s.from_url = twoGisOpenLink(lat, lon);
      s.step = 'to';
      s.await = null;
      await replaceWith(ctx, `A: ${label} ✅`, kbBackHome(), 1500);
      return askPointB(ctx);
    } else {
      s.to_lat = lat;
      s.to_lon = lon;
      s.to_text = label;
      s.to_url = twoGisOpenLink(lat, lon);
      s.await = null;
      return afterAB(ctx);
    }
  });

  // Комментарий — да/нет
  composer.action('cli_comment_yes', async (ctx) => {
    await ctx.answerCbQuery();
    (ctx.session as any).step = 'commentWait';
    return replaceWith(
      ctx,
      'Пришлите комментарий одним сообщением.',
      kbBackHome(),
    );
  });
  composer.action('cli_comment_no', async (ctx) => {
    await ctx.answerCbQuery();
    (ctx.session as any).comment_text = null;
    return confirmOrder(ctx);
  });

  // Создание заказа
  composer.action('cli_make_order', async (ctx) => {
    await ctx.answerCbQuery();
    const s = ctx.session as ClientOrderSession;
    if (!s || s.flow !== 'client_order')
      return replaceWith(ctx, 'Сессия истекла.', kbBackHome());

    const row: any = {
      type: s.type,
      client_telegram_id: ctx.from!.id,
      from_text: s.from_text || null,
      to_text: s.to_text || null,
      from_lat: s.from_lat || null,
      from_lon: s.from_lon || null,
      to_lat: s.to_lat || null,
      to_lon: s.to_lon || null,
      from_url: s.from_url || null,
      to_url: s.to_url || null,
      comment_text: s.comment_text || null,
      price_estimate: s.fare_fixed_tg || null,
      fare_fixed_tg: s.fare_fixed_tg || null,
      distance_km: s.distance_km || null,
      status: 'NEW',
    };

    // v2 API: .single() вместо maybeSingle()
    const ins = await supabase.from('orders').insert(row).select('*').single();
    if (ins.error || !ins.data)
      return replaceWith(ctx, 'Не удалось создать заказ.', kbBackHome());
    const o = ins.data;
    ctx.session = {}; // сбрасываем сессию клиента

    const chId = Number(await getSetting('drivers_channel_id')) || 0;
    const openA = s.from_lat
      ? twoGisOpenLink(s.from_lat, s.from_lon)
      : s.from_url || TWO_GIS_OPEN_URL;
    const openB = s.to_lat
      ? twoGisOpenLink(s.to_lat, s.to_lon)
      : s.to_url || TWO_GIS_OPEN_URL;

    const cap = [
      `🆕 <b>${o.type === 'TAXI' ? 'Заказ (такси)' : 'Заказ (доставка)'}</b>`,
      `A: ${o.from_text || '-'}  —  <a href="${openA}">Открыть в 2ГИС</a>`,
      `B: ${o.to_text || '-'}  —  <a href="${openB}">Открыть в 2ГИС</a>`,
      o.distance_km ? `Дистанция: ~${Number(o.distance_km).toFixed(1)} км` : null,
      o.fare_fixed_tg ? `Цена: <b>${o.fare_fixed_tg} тг</b>` : 'Цена: договорная',
      o.comment_text ? `Комментарий: ${o.comment_text}` : null,
      `ID: <code>${o.id}</code>`,
    ]
      .filter(Boolean)
      .join('\n');

    const btn = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Принять', `ord_acc:${o.id}`)],
    ]);

    if (chId) {
      try {
        const posted = await ctx.telegram.sendMessage(chId, cap, {
          parse_mode: 'HTML',
          ...btn,
        });
        await supabase
          .from('orders')
          .update({ drivers_channel_msg_id: (posted as any).message_id })
          .eq('id', o.id);
      } catch (e) {
        console.error('post to channel', e);
      }
    }

    // Рассылка онлайн-исполнителям в ЛС
    await pushOrderToOnline(ctx.telegram as any, o, cap);

    await replaceWith(
      ctx,
      `Заказ создан. Ожидайте исполнителя.\nID: <code>${o.id}</code>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Отменить текущий заказ', `cli_cancel:${o.id}`)],
          [Markup.button.callback('➕ Заказать ещё', 'role_client')],
          [Markup.button.callback('🔙 На главную', 'go_home')],
        ]),
      },
      TTL_INFO_MS * 2,
    );
  });

  // Отмена клиентом (пока статус NEW)
  composer.action(/cli_cancel:(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const id = (ctx.match as any)[1];

    const sel = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (sel.error) {
      if (isNotFound(sel.error))
        return replaceWith(ctx, 'Не найдено.', kbBackHome());
      return replaceWith(ctx, 'Ошибка.', kbBackHome());
    }

    const o = sel.data!;
    if (o.client_telegram_id !== ctx.from!.id)
      return replaceWith(ctx, 'Это не ваш заказ.', kbBackHome());
    if (o.status !== 'NEW')
      return replaceWith(
        ctx,
        'Уже принят исполнителем, отмена недоступна.',
        kbBackHome(),
      );

    const upd = await supabase
      .from('orders')
      .update({ status: 'CANCELLED', canceled_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (upd.error)
      return replaceWith(ctx, 'Ошибка отмены.', kbBackHome());

    if (o.drivers_channel_msg_id) {
      const chId = Number(await getSetting('drivers_channel_id')) || 0;
      try {
        await ctx.telegram.editMessageReplyMarkup(
          chId,
          o.drivers_channel_msg_id as any,
          undefined,
          { inline_keyboard: [] },
        );
      } catch {}
      try {
        await ctx.telegram.sendMessage(
          chId,
          `⛔️ Заказ <code>${id}</code> отменён клиентом.`,
          { parse_mode: 'HTML' },
        );
      } catch {}
    }

    return replaceWith(ctx, 'Отменён.', kbBackHome());
  });

  // Подключаем composer в бота
  bot.use(composer.middleware());
}
