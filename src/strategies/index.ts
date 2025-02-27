import { userSettings } from "../settingsData";
import PoolRecommendationStrategyRouter from "./poolRecommendationStrategy/poolRecommendationStrategy.router";

export default class Strategy {
  private static instance: Strategy;
  private currentStrategyName = userSettings["GENERAL"]["STRATEGY"];

  constructor() {}

  public static async getInstance(): Promise<Strategy> {
    if (!Strategy.instance) {
      const service = new Strategy();
      await service.init();
      Strategy.instance = service;
    }
    return Strategy.instance;
  }

  private async init() {
    if (this.currentStrategyName === "poolRecommendationStrategy") {
      await PoolRecommendationStrategyRouter.getInstance();
    }
  }
}
