// src/index.ts
import 'dotenv/config';
import express from 'express';
import { bot } from './bot';
import { IS_PROD, WEBHOOK_DOMAIN, WEBHOOK_PATH, PORT } from './config';

// модули
import * as home         from './modules/home';
import * as roles        from './modules/roles';
import * as storage      from './modules/storage';
import * as support      from './modules/support';
import * as subscription from './modules/subscription';
import * as verification from './modules/verification';
import * as user_phone   from './modules/user_phone';
import * as orders       from './modules/orders';
import * as client_flow  from './modules/client_flow';

type Registrar = (b: typeof bot) => void;
const isFunc = (f: unknown): f is Registrar => typeof f === 'function';

/** Универсальная регистрация: ищем любую «ожидаемую» точку входа */
function register(ns: Record<string, unknown>) {
  const candidates = [
    'register', 'init', 'mount', 'setup', 'default',
    'registerHome', 'registerRoles', 'registerStorage',
    'registerSupport', 'registerSubscription'
  ];
  for (const key of candidates) {
    const fn = (ns as any)[key];
    if (isFunc(fn)) {
      fn(bot);
      return;
    }
  }
  // если в модуле ничего не нашли — пропускаем
}

// регистрируем все модули
[home, roles, storage, support, subscription, verification, user_phone, orders, client_flow].forEach(register);

// глобальный catcher
bot.catch((err, ctx) => {
  console.error('Bot error', err);
  try {
    ctx.reply('Произошла ошибка. Попробуйте позже.').catch(() => {});
  } catch {}
});

async function launch() {
  if (IS_PROD) {
    if (!WEBHOOK_DOMAIN) {
      throw new Error('WEBHOOK_DOMAIN is not defined in environment variables');
    }
    if (!/^https:\/\/.+/i.test(WEBHOOK_DOMAIN)) {
      throw new Error('TELEGRAM_WEBHOOK_DOMAIN должен быть публичным https-URL');
    }

    const app = express();
    app.use(bot.webhookCallback(WEBHOOK_PATH));
    app.get('/', (_req, res) => res.send('OK'));
    app.listen(PORT, async () => {
      await bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}${WEBHOOK_PATH}`);
      console.log(`Webhook set → ${WEBHOOK_DOMAIN}${WEBHOOK_PATH} (port ${PORT})`);
    });
  } else {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
    await bot.launch({ dropPendingUpdates: true });
    console.log('Started polling (dev)');
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}

launch();
