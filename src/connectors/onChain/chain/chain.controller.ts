import { PublicKey } from "@solana/web3.js";
import { TPrices } from "../../../types";
import OrcaService from "../dex/orca/orca.service";
import SolanaService from "./solana/solana.service";
import { getMint } from "@solana/spl-token";

export default class ChainController {
  private static instance: ChainController;
  private solanaService!: SolanaService;
  public prices!: TPrices;

  constructor() {}

  public static async getInstance(): Promise<ChainController> {
    if (!ChainController.instance) {
      const service = new ChainController();
      await service.init();
      ChainController.instance = service;
    }
    return ChainController.instance;
  }

  private async init() {
    this.solanaService = await SolanaService.getInstance();
    this.prices = this.solanaService.prices;
  }

  async getBalances(chain: string) {
    if (chain === "solana") return this.solanaService.getAllBalances();
    this.prices = this.solanaService.prices;
    return [];
  }

  async getTokenInfo(chain: string, inputMint: string) {
    if (chain === "solana")
      return await getMint(
        this.solanaService.connection,
        new PublicKey(inputMint)
      );
  }
}
