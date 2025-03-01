import { retryOperation } from "../../../utils/general";
import JupiterService from "./jupter/jupiter.service";
import OrcaService from "./orca/orca.service";

export default class DexController {
  private static instance: DexController;
  private orcaService!: OrcaService;
  private jupterService!: JupiterService;

  constructor() {}

  public static async getInstance(): Promise<DexController> {
    if (!DexController.instance) {
      const service = new DexController();
      await service.init();
      DexController.instance = service;
    }
    return DexController.instance;
  }

  private async init() {
    this.orcaService = await OrcaService.getInstance();
    this.jupterService = await JupiterService.getInstance();
  }

  async fetchPools(dexName: string) {
    if (dexName === "orca") {
      return await this.orcaService.fetchPools();
    }
    throw new Error("Dex not implemented");
  }

  async getOpenPositions(dexName: string) {
    if (dexName === "orca") {
      return await this.orcaService.getOpenPositions();
    }
    throw new Error("Dex not implemented");
  }

  async estimateSwap(
    dexName: string,
    inputMint: string,
    outputMint: string,
    amount: number,
    considerAmountTokenOut: boolean = false
  ) {
    if (dexName === "jupiter") {
      return await this.jupterService.estimateSwap(
        inputMint,
        outputMint,
        amount,
        considerAmountTokenOut
      );
    }
    throw new Error("Dex not implemented");
  }

  async executeSwap(dexName: string, swapReq: any, quoteResponse: any) {
    if (dexName === "jupiter") {
      return await this.jupterService.executeSwap({ swapReq, quoteResponse });
    }
    throw new Error("Dex not implemented");
  }

  async executeDirectSwap(
    dexName: string,
    inputMint: string,
    outputMint: string,
    amount: number,
    considerAmountTokenOut: boolean = false,
    mock = false,
    attempts = 1
  ) {
    if (dexName === "jupiter") {
      return retryOperation(
        async () => {
          const estimateSwapRes = await this.jupterService.estimateSwap(
            inputMint,
            outputMint,
            amount,
            considerAmountTokenOut
          );
          if (!mock) await this.jupterService.executeSwap(estimateSwapRes);
          return estimateSwapRes;
        },
        1000,
        attempts
      );
    }
    throw new Error("Dex not implemented");
  }

  async estimatePosition(
    dexName: string,
    poolAddress: string,
    rangePercent: number,
    baseTokenMint: string,
    baseTokenAmount: number
  ) {
    if (dexName === "orca") {
      return await this.orcaService.estimatePosition(
        poolAddress,
        rangePercent,
        baseTokenMint,
        baseTokenAmount
      );
    }

    throw new Error("Dex not implemented");
  }

  async executePosition(
    dexName: string,
    { positionQuote, tokenA, tokenB, rangePercent }: any,
    isMock = false
  ) {
    if (dexName === "orca") {
      return await this.orcaService.executePosition(
        positionQuote,
        tokenA,
        tokenB,
        rangePercent,
        isMock
      );
    }

    throw new Error("Dex not implemented");
  }

  async closePositionByPositionId(dexName: string, positionMint: string) {
    if (dexName === "orca") {
      return await this.orcaService.closePositionByPositionId(positionMint);
    }

    throw new Error("Dex not implemented");
  }
}
