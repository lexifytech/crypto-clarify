import TelegramBotService from "./services/telegramBot.service";
import Strategy from "./strategies";

export const telegramBotService = new TelegramBotService().launch();

// Startup do bot
(async () => {
  await Strategy.getInstance();
})();
