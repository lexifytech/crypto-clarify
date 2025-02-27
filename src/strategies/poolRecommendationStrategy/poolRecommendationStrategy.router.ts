import cron from "node-cron";
import { telegramBotService } from "../..";
import PoolRecommendationStrategyController from "./poolRecommendationStrategy.controller";
import { userSettings } from "../../settingsData";

export default class PoolRecommendationStrategyRouter {
  private static instance: PoolRecommendationStrategyRouter;
  private poolRecommendationStrategyController!: PoolRecommendationStrategyController;
  private cronTask: cron.ScheduledTask | null = null;

  constructor() {}

  public static async getInstance(): Promise<PoolRecommendationStrategyRouter> {
    if (!PoolRecommendationStrategyRouter.instance) {
      const service = new PoolRecommendationStrategyRouter();
      await service.init();
      PoolRecommendationStrategyRouter.instance = service;
    }
    return PoolRecommendationStrategyRouter.instance;
  }

  private async init() {
    this.poolRecommendationStrategyController =
      await PoolRecommendationStrategyController.getInstance();

    telegramBotService.command("strategy", (ctx) => {
      let helpMessage = `STRATEGY INFO\n\n`;
      helpMessage += `Current Strategy: poolRecommendationStrategy\n\n`;
      helpMessage += `/run -> Run the strategy in loop every ${userSettings["POOLRECOMMENDATIONSTRATEGY"]["CRON_TIME_MINUTE"]} minutes. \n`;
      helpMessage += `/stop -> Stop the strategy\n`;
      helpMessage += `/execute -> Execute strategy once\n`;
      helpMessage += `/balances -> Get your balance\n`;
      helpMessage += `/positions -> Get your open positions\n`;

      ctx.reply(helpMessage);
    });

    telegramBotService.command("status", (ctx) => {
      const helpMessage = this.cronTask ? "Bot is runnig." : "Bot is stoped.";
      ctx.reply(helpMessage);
    });

    telegramBotService.command("run", (ctx) => {
      if (!this.cronTask) {
        this.cronTask = cron.schedule(
          `*/${userSettings["POOLRECOMMENDATIONSTRATEGY"]["CRON_TIME_MINUTE"]} * * * *`,
          () => {
            this.poolRecommendationStrategyController.executeRoutineCron(ctx);
          }
        );
        this.poolRecommendationStrategyController.executeRoutineCron(ctx);
        ctx.reply("Bot is runnig.");
      } else {
        ctx.reply("Bot is already running.");
      }
    });

    telegramBotService.command("stop", (ctx) => {
      if (this.cronTask) {
        this.cronTask.stop();
        this.cronTask = null;
        ctx.reply("Bot is stoped.");
      } else {
        ctx.reply("Bot is already stoped.");
      }
    });

    telegramBotService.command("balances", (ctx) => {
      this.poolRecommendationStrategyController.getBalances(ctx);
    });

    telegramBotService.command("positions", (ctx) => {
      this.poolRecommendationStrategyController.getOpenPositions(ctx);
    });

    telegramBotService.command("execute", (ctx) => {
      this.poolRecommendationStrategyController.executeRoutineCron(ctx);
    });
  }
}
