import express from "express";
import { Telegraf, session } from "telegraf";

import { BOT_TOKEN, IS_PROD, WEBHOOK_DOMAIN, WEBHOOK_PATH, PORT } from "./config";
import { MyContext } from "./types";
import { supabase } from "./supabase";

// модули
import { registerUtils } from "./modules/utils";
import { registerStorage } from "./modules/storage";
import { registerReceipts } from "./modules/receipts";
import { registerRoles } from "./modules/roles";
import { registerPhone } from "./modules/phone";
import { registerVerify } from "./modules/verify";
import { registerSubscription } from "./modules/subscription";
import { registerSupport } from "./modules/support";
import { registerOrders } from "./modules/orders";
import { registerClientFlow } from './modules/client_flow';

const bot = new Telegraf<MyContext>(BOT_TOKEN, { handlerTimeout: 30_000 });
bot.use(session());

/** ============== Подключение модулей ============== */
registerUtils(bot, supabase);
registerStorage(bot, supabase);
registerReceipts(bot, supabase);
registerRoles(bot, supabase);
registerPhone(bot, supabase);
registerVerify(bot, supabase);
registerSubscription(bot, supabase);
registerSupport(bot, supabase);
registerOrders(bot, supabase);
registerClientFlow(bot);

/** ============== Запуск ============== */
bot.catch((err, ctx) => {
  console.error("Bot error", err);
  try {
    ctx.reply("Произошла ошибка. Попробуйте позже.").catch(() => {});
  } catch {}
});

async function launch() {
  if (IS_PROD) {
    if (!/^https:\/\/.+/i.test(WEBHOOK_DOMAIN)) {
      throw new Error("TELEGRAM_WEBHOOK_DOMAIN должен быть публичным https-URL");
    }
    const app = express();
    app.use(bot.webhookCallback(WEBHOOK_PATH));
    app.get("/", (_req, res) => res.send("OK"));
    app.listen(PORT, async () => {
      await bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}${WEBHOOK_PATH}`);
      console.log(`Webhook set → ${WEBHOOK_DOMAIN}${WEBHOOK_PATH} (port ${PORT})`);
    });
  } else {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
    await bot.launch({ dropPendingUpdates: true });
    console.log("Started polling (dev)");
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  }
}
launch();
