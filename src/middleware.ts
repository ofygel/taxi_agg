import { bot } from './bot';
import { textHandlers, mediaHandlers, locationHandlers, messageEditHandlers } from './registry';

async function runChain(handlers: typeof textHandlers, ctx: any) {
  for (const h of handlers) {
    try {
      const handled = await h(ctx);
      if (handled) return true;
    } catch (e) { console.error('handler error', e); }
  }
  return false;
}

export function installUnifiedMiddleware() {
  bot.on('text', async (ctx) => { await runChain(textHandlers, ctx); });
  bot.on(['photo', 'document'], async (ctx) => { await runChain(mediaHandlers, ctx); });
  bot.on('location', async (ctx) => { await runChain(locationHandlers, ctx); });
  bot.on('edited_message', async (ctx) => { await runChain(messageEditHandlers, ctx); });
}
