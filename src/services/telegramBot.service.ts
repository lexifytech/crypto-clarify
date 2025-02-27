import { Telegraf, Context } from "telegraf";
import { userSettings } from "../settingsData";

export default class TelegramBotService {
  private client = new Telegraf<Context>(userSettings["GENERAL"]["TELEGRAM_BOT_FATHER_TOKEN"]);

  constructor() {}

  public launch() {
    this.client
      .launch()
      .then(() => {
        console.log("Bot is running!");
      })
      .catch((error) => {
        console.error("Error starting bot:", error);
      });

    process.once("SIGINT", () => this.client.stop("SIGINT"));
    process.once("SIGTERM", () => this.client.stop("SIGTERM"));

    this.client.start((ctx) => {
      ctx.reply(
        "Welcome to the crypto-bot, /strategy to see your strategy options."
      );
    });

    this.client.command("help", (ctx) => {
      ctx.reply(
        "Welcome to the crypto-bot, /strategy to see your strategy options."
      );
    });

    return this.client;
  }
}
