import ChainController from "../../connectors/onChain/chain/chain.controller";
import DexController from "../../connectors/onChain/dex/dex.controller";
import { minimizeHash } from "../../utils/chain";
import PoolRecommendationStrategy from "./poolRecommendationStrategy.sevice";

export default class PoolRecommendationStrategyController {
  private static instance: PoolRecommendationStrategyController;
  private chain!: ChainController;
  private dex!: DexController;
  private poolRecommendationStrategy!: PoolRecommendationStrategy;

  constructor() {}

  public static async getInstance(): Promise<PoolRecommendationStrategyController> {
    if (!PoolRecommendationStrategyController.instance) {
      const service = new PoolRecommendationStrategyController();
      await service.init();
      PoolRecommendationStrategyController.instance = service;
    }
    return PoolRecommendationStrategyController.instance;
  }

  private async init() {
    this.chain = await ChainController.getInstance();
    this.dex = await DexController.getInstance();
    this.poolRecommendationStrategy =
      await PoolRecommendationStrategy.getInstance();
  }

  async getBalances(ctx: any) {
    try {
      const balances = await this.chain.getBalances("solana");
      let replyMessage = "HOLD BALANCES:\n";
      let usdAmount = 0;
      balances.forEach((balance) => {
        replyMessage += `\n${minimizeHash(balance.mint)} -> ${
          balance.humanAmount
        } ($${balance.amountUSD})`;
        usdAmount += balance.amountUSD;
      });
      replyMessage += `\n\nAMOUNT: $${usdAmount.toFixed(2)}`;
      ctx.reply(replyMessage);
    } catch (error: any) {
      const errorMessage = `ERROR:\n${error.message}`;
      console.error(errorMessage);
      ctx.reply(errorMessage);
    }
  }

  async getOpenPositions(ctx: any) {
    try {
      const positions = await this.dex.getOpenPositions("orca");
      let replyMessage = `${positions?.length || 0} OPEN POSITIONS: \n`;
      let usdAmount = 0;
      for (const position of positions || []) {
        replyMessage += `\n${minimizeHash(position.poolAddress)} ~ $${
          position.amountPositionUsd
        }`;
        usdAmount += position.amountPositionUsd;
      }
      replyMessage += `\n\nAMOUNT: $${usdAmount.toFixed(2)}`;

      ctx.reply(replyMessage);
    } catch (error: any) {
      const errorMessage = `ERROR:\n${error.message}`;
      console.error(errorMessage);
      ctx.reply(errorMessage);
    }
  }

  async executeRoutineCron(ctx: any) {
    try {
      console.log('RUNNING CRON ROUTINE...')
      const messageRes = await this.poolRecommendationStrategy.mainRoutineCron();
      ctx.reply(messageRes);
    } catch (error: any) {
      console.error("ERROR CORN ROUTINE:\n", error.message);
      ctx.reply(`ERROR:\n${error.message}`);
    }
  }
}
