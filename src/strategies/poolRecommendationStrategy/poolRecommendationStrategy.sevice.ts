import ChainController from "../../connectors/onChain/chain/chain.controller";
import DexController from "../../connectors/onChain/dex/dex.controller";
import { config } from "../../config/config";
import { database } from "../../services/database.service";
import { minimizeHash } from "../../utils/chain";
import { userSettings } from "../../settingsData";
import { DecimalUtil } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import { BN } from "@coral-xyz/anchor";
import { TPoolData, TPositionData } from "../../types";

export default class PoolRecommendationStrategyService {
  private static instance: PoolRecommendationStrategyService;
  private chain!: ChainController;
  private dex!: DexController;

  constructor() {}

  public static async getInstance(): Promise<PoolRecommendationStrategyService> {
    if (!PoolRecommendationStrategyService.instance) {
      const service = new PoolRecommendationStrategyService();
      await service.init();
      PoolRecommendationStrategyService.instance = service;
    }
    return PoolRecommendationStrategyService.instance;
  }

  private async init() {
    this.chain = await ChainController.getInstance();
    this.dex = await DexController.getInstance();
  }

  async mainRoutineCron() {
    let completeLog = "OPERATION LOGS:";
    let logClosePositions = "";
    let logOpenPositiions = "";
    let logSellTokens = "";
    let positions: TPositionData[] = [];
    let logBalances = "";

    try {
      const closePositionRes = await this.part1ClosePools();
      logClosePositions = closePositionRes.logClosePositions;
      positions = closePositionRes.positions;
    } catch (error: any) {
      logClosePositions += ` - ERROR:\n${error.message}`;
    }
    try {
      logOpenPositiions = await this.part2OpenPools(positions);
    } catch (error: any) {
      logOpenPositiions += ` - ERROR:\n${error}`;
    }

    try {
      const part3Logs = await this.part3SellTokensAndGetResume();
      logSellTokens = part3Logs.logSellTokens;
      logBalances = part3Logs.logBalances;
    } catch (error: any) {
      logOpenPositiions += `${
        (logSellTokens || logBalances) &&
        ` - ERROR: \n${logSellTokens || logBalances}`
      }`;
    }

    completeLog += "\n\nSTEP 1: CLOSE POSITIONS:\n";
    if (logClosePositions) {
      completeLog += logClosePositions;
    } else {
      completeLog += " - No positions closed.";
    }

    completeLog += "\n\nSTER 2: OPEN POSITIONS:\n";
    if (logOpenPositiions) {
      completeLog += logOpenPositiions;
    } else {
      completeLog += " - No positions opened.";
    }

    completeLog += "\n\nSTEP 3: SOLD TOKENS :\n";
    if (logSellTokens) {
      completeLog += logSellTokens;
    } else {
      completeLog += " - No tokens swaped.";
    }

    if (logBalances) {
      completeLog += "\n";
      completeLog += logBalances;
    } else {
      completeLog += " - No balance found.";
    }

    return completeLog;
  }

  async part1ClosePools() {
    let logClosePositions = "";
    let countClosePositions = 0;

    let positions = await this.dex.getOpenPositions("orca");
    for (let position of positions) {
      const storagedPosition = await database.getOpenPositionByPositionMint(
        position.positionMint
      );
      if (!storagedPosition) continue;

      const usdPNL = position.amountPositionUsd - storagedPosition.usdAmount;
      const usdPercentPNL = (usdPNL / storagedPosition.usdAmount) * 100;

      // stop trailing calc
      const peakUsdAmount = Math.max(
        ...storagedPosition.updates.map((update: any) => update.usdAmount)
      );
      const stopTrailingUsd = position.amountPositionUsd - peakUsdAmount;
      const stopTrailingPercent = (stopTrailingUsd / peakUsdAmount) * 100;

      console.log(
        "STOP TRAILING:",
        stopTrailingUsd,
        "WAITING:",
        userSettings["POOLRECOMMENDATIONSTRATEGY"]["STOP_LOSS_TRAILIG_PERCENT"]
      );

      await database.addPositionUpdate(position.positionMint, {
        date: new Date(),
        tokenAAmountUsd: position.amountTokenAUsd,
        tokenBAmountUsd: position.amountTokenBUSD,
        usdAmount: position.amountPositionUsd,
        usdPNL,
        usdPercentPNL,
        peakUsdAmount,
        stopTrailingUsd,
        stopTrailingPercent,
      });

      // CLOSE IF OUT OF RANGE, OR STOP TRAILING
      if (
        !position.inRange ||
        stopTrailingPercent <=
          -Math.abs(
            userSettings["POOLRECOMMENDATIONSTRATEGY"][
              "STOP_LOSS_TRAILIG_PERCENT"
            ]
          )
      ) {
        await this.dex.closePositionByPositionId("orca", position.positionId);
        await database.closePosition(position.positionMint);
        countClosePositions++;
        logClosePositions += `${position.positionMint} ~ $${position.amountPositionUsd}`;
        console.log(
          ` - ${minimizeHash(position.positionMint)} ~ $${
            position.amountPositionUsd
          }`
        );
        positions = positions.filter(
          (p) => p.positionMint !== position.positionMint
        );
      }
    }
    return { logClosePositions, positions };
  }

  async part2OpenPools(positions: TPositionData[]) {
    let logOpenPositions = "";
    let countOpenedPositions = 0;
    let balances = [];

    const pools = await this.dex.fetchPools("orca");

    const top10ByTvl = pools
      .sort((a, b) => parseFloat(b.tvlUsdc) - parseFloat(a.tvlUsdc))
      .slice(0, 10);
    const opportunities = top10ByTvl.sort(
      (a, b) => parseFloat(b.yieldOverTvl) - parseFloat(a.yieldOverTvl)
    );

    if (!opportunities || opportunities.length <= 0)
      return " - No opportunities.";

    if (
      positions.length >=
      userSettings["POOLRECOMMENDATIONSTRATEGY"]["SIMULTANEOUS_ENTRIES"]
    )
      return "";

    const newOpportunities = opportunities.filter(
      (o: any) => !positions.find((p) => p.poolAddress === o.address)
    );

    const { balances: b, errorMessages } =
      await this.verifyBalancesBeforeExecute();

    balances = b;

    if (errorMessages.length > 0) return "No balance";

    for (let opportunity of newOpportunities) {
      try {
        if (
          positions.length + countOpenedPositions >=
          userSettings["POOLRECOMMENDATIONSTRATEGY"]["SIMULTANEOUS_ENTRIES"]
        )
          continue;

        if (countOpenedPositions > 0) {
          const { balances: b, errorMessages } =
            await this.verifyBalancesBeforeExecute();
          balances = b;
          if (errorMessages.length > 0) continue;
        }

        const usdEntryValue =
          userSettings["POOLRECOMMENDATIONSTRATEGY"]["USD_ENTRY_VALUE"];
        const tokenAEntryValue =
          usdEntryValue /
            //@ts-ignore
            this.chain.prices[opportunity.tokenA.address] || usdEntryValue;
        const tokenAPositionAmount = DecimalUtil.toBN(
          new Decimal(tokenAEntryValue / 2),
          opportunity.tokenA.decimals
        );

        const range = this.calculateAutoRangePercent(
          parseFloat(opportunity.yieldOverTvl),
          parseFloat(opportunity.tvlUsdc)
        );

        console.log(
          "OPEN POOL",
          `${opportunity.tokenA.symbol}/${opportunity.tokenB.symbol} ~ $${usdEntryValue}`
        );

        const estimatePositionRes = await this.dex.estimatePosition(
          "orca",
          opportunity.address,
          range,
          opportunity.tokenA.address,
          tokenAPositionAmount
        );

        const swapsRes = await this.makeSwapForPool(
          opportunity,
          estimatePositionRes.amountTokenA,
          estimatePositionRes.amountTokenB,
          balances
        );

        if (!swapsRes) continue;

        console.log(
          "TOKENS AVAILABLE TO POOL:",
          swapsRes.outputAmountA.toString(),
          swapsRes.outputAmountB.toString()
        );

        await this.dex.executePosition("orca", estimatePositionRes);

        console.log(
          ` - POSITION OPENED: ${opportunity.tokenA.symbol}/${opportunity.tokenB.symbol} ~$${userSettings["POOLRECOMMENDATIONSTRATEGY"]["USD_ENTRY_VALUE"]}`
        );

        logOpenPositions += ` - POSITION OPENED: ${opportunity.tokenA.symbol}/${opportunity.tokenB.symbol} ~$${userSettings["POOLRECOMMENDATIONSTRATEGY"]["USD_ENTRY_VALUE"]}\n`;
        countOpenedPositions++;
      } catch (error: any) {
        const messageError = error.message as string;
        if (messageError.includes("insufficient lamports")) {
          logOpenPositions += ` - ERRO OPENING POSITION: INSUFFICIENT LAMPORTS (YOU NEED MORE SOL)\n`;
        } else if (messageError.includes("insufficient funds")) {
          logOpenPositions += ` - ERRO OPENING POSITION: INSUFFICIENT FUNDS (SWAP WAS WRONG)\n`;
        } else if (
          messageError.includes("tick_array_lower") ||
          messageError.includes("tick_array_upper")
        ) {
          logOpenPositions += ` - ERRO OPENING POSITION: TICK ARE NOT RIGTH (SWAP WAS WRONG)\n`;
        } else {
          logOpenPositions += ` - ERRO OPENING POSITION: ${error.message}`;
          console.log(error.message);
        }
      }
    }

    return logOpenPositions;
  }

  async part3SellTokensAndGetResume() {
    let logSellTokens = ``;
    let logBalances = ``;
    const soldTokens: string[] = [];

    let allBalances = await this.chain.getBalances("solana");

    const filteredBalances = allBalances.filter(
      (b) =>
        !userSettings["POOLRECOMMENDATIONSTRATEGY"]["HOLD_TOKENS"].find(
          (t: any) => t === b.mint
        )
    );

    for (let balance of filteredBalances) {
      const inputMint = balance.mint;
      const outputMint =
        userSettings["POOLRECOMMENDATIONSTRATEGY"]["BASE_ASSET"];
      const inputAmount = balance.amount;
      await this.dex.executeDirectSwap(
        "jupiter",
        inputMint,
        outputMint,
        inputAmount
      );
      soldTokens.push(inputMint);
      logSellTokens += ` - ${minimizeHash(inputMint)} ~$${balance.amountUSD}\n`;
    }

    // WALLET WALLET HOLD LOG
    if (logSellTokens) allBalances = await this.chain.getBalances("solana");
    let balancesAmountUsd = 0;
    logBalances += `\n\nHOLD WALLET:\n`;
    allBalances.forEach((balance) => {
      const wasSoldToken = soldTokens.find((mint) => mint === balance.mint);
      if (!wasSoldToken) {
        logBalances += ` - ${minimizeHash(balance.mint)} -> ${
          balance.humanAmount
        } ($${balance.amountUSD})\n`;
        balancesAmountUsd += balance.amountUSD;
      }
    });
    logBalances += `   HOLD AMOUNT: $${balancesAmountUsd.toFixed(2)}\n`;

    // OPEN POSITIONS LOG
    let positionAmountUsd = 0;
    logBalances += `\nOPEN POSITIONS:\n`;
    let allPositions = await this.dex.getOpenPositions("orca");
    let amountPnlUsdPercent = 0;
    let amountPnlUsValue = 0;
    for (const position of allPositions || []) {
      const storagedPosition = await database.getOpenPositionByPositionMint(
        position.positionMint
      );
      const lastUpdate =
        storagedPosition.updates[storagedPosition.updates.length - 1];

      const pnlUsd = parseFloat(
        (position.amountPositionUsd - lastUpdate.usdAmount).toFixed(2)
      );
      const pnlUsdPercent = parseFloat(
        ((pnlUsd / lastUpdate.usdAmount) * 100).toFixed(2)
      );
      amountPnlUsdPercent += pnlUsdPercent;
      amountPnlUsValue += pnlUsd;

      logBalances += ` - ${minimizeHash(position.poolAddress)} ~ $${
        position.amountPositionUsd
      } (${pnlUsdPercent.toFixed(2)}% ~ $${pnlUsd.toFixed(2)})\n`;
      positionAmountUsd += position.amountPositionUsd;
    }
    logBalances += `   POSITIONS AMOUNT: $${positionAmountUsd.toFixed(
      2
    )} (${amountPnlUsdPercent.toFixed(2)}% ~ $${amountPnlUsValue.toFixed(2)})`;

    logBalances += `\n\nAMOUNT: $${(
      balancesAmountUsd + positionAmountUsd
    ).toFixed(2)}`;

    return { logSellTokens, logBalances };
  }

  private async verifyBalancesBeforeExecute() {
    const errorMessages = [];
    const balances = await this.chain.getBalances("solana");

    const baseTokenBalance = balances.find(
      (e) => e.mint === userSettings["POOLRECOMMENDATIONSTRATEGY"]["BASE_ASSET"]
    );

    const solTokenBalance = balances.find((e) => e.mint === config.SOL_MINT);

    if (!solTokenBalance || solTokenBalance?.amountUSD <= 5) {
      console.log(`Insufficient SOL Balance. You need > $5 in SOL`);
      errorMessages.push(`Insufficient SOL Balance. You need > $5 in SOL`);
    }

    if (
      !baseTokenBalance ||
      baseTokenBalance.amountUSD <=
        userSettings["POOLRECOMMENDATIONSTRATEGY"]["USD_ENTRY_VALUE"]
    ) {
      console.log(
        `Insufficient ENTRY_VALUE balance. You need even ${userSettings["POOLRECOMMENDATIONSTRATEGY"]["USD_ENTRY_VALUE"]} in your base asset.`
      );
      errorMessages.push(
        `Insufficient ENTRY_VALUE balance. You need even ${userSettings["POOLRECOMMENDATIONSTRATEGY"]["USD_ENTRY_VALUE"]} in your base asset.`
      );
    }

    return {
      errorMessages,
      balances,
    };
  }

  private async makeSwapForPool(
    poolData: TPoolData,
    outputAmountTokenA: BN,
    outputAmountTokenB: BN,
    balances: any,
    isMock = false
  ) {
    try {
      if (isMock)
        return {
          outputAmountA: outputAmountTokenA,
          outputAmountB: outputAmountTokenB,
        };
      const baseAssetMint =
        userSettings["POOLRECOMMENDATIONSTRATEGY"]["BASE_ASSET"];
      const tokenABalance =
        balances.find((b: any) => b.mint === poolData.tokenA.address) || 0;
      const tokenBBalance =
        balances.find((b: any) => b.mint === poolData.tokenB.address) || 0;

      let outputAmountA = outputAmountTokenA;
      let outputAmountB = outputAmountTokenB;

      if (
        (tokenABalance.amount || 0) < outputAmountTokenA.toNumber() &&
        poolData.tokenA.address !== baseAssetMint
      ) {
        const tokenOutAmount = outputAmountTokenA.sub(
          new BN(tokenABalance.amount || 0)
        );
        const resSwap1 = await this.dex.executeDirectSwap(
          "jupiter",
          baseAssetMint,
          poolData.tokenA.address,
          tokenOutAmount.toString(),
          true
        );
        outputAmountA = outputAmountTokenA.add(
          new BN(resSwap1?.quoteResponse.outAmount)
        );
      }

      if (
        (tokenBBalance.amount || 0) < outputAmountTokenB.toNumber() &&
        poolData.tokenB.address !== baseAssetMint
      ) {
        const tokenOutAmount = outputAmountTokenB.sub(
          new BN(tokenBBalance.amount || 0)
        );
        const resSwap2 = await this.dex.executeDirectSwap(
          "jupiter",
          baseAssetMint,
          poolData.tokenB.address,
          tokenOutAmount.toString(),
          true
        );
        outputAmountB = outputAmountTokenB.add(
          new BN(resSwap2?.quoteResponse.outAmount)
        );
      }

      return { outputAmountA, outputAmountB };
    } catch (error: any) {
      console.log("ERRO SWAPPING: ", error.message);
      return null;
    }
  }

  private calculateAutoRangePercent(
    yieldOverTvl: number,
    tvlUsdc: number
  ): number {
    // Exemplo de regra combinada:
    // Se yield for alto e TVL for alto, use um range mais restrito (ex: 2%)
    // Se yield for moderado ou TVL for baixo, use um range moderado (ex: 3%)
    // Caso contrário, use 5%
    if (yieldOverTvl > 0.01 && tvlUsdc > 1_000_000) {
      return 2;
    } else if (yieldOverTvl > 0.005 || tvlUsdc < 500_000) {
      return 3;
    } else {
      return 5;
    }
  }
}
