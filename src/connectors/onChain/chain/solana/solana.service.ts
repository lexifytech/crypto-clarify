import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { database } from "../../../../services/database.service";
import OrcaService from "../../dex/orca/orca.service";
import { config } from "../../../../config/config";
import { userSettings } from "../../../../settingsData";
import axios from "axios";
import { TPrices } from "../../../../types";

class SolanaService {
  private static instance: SolanaService;
  public rpcEndpoint = userSettings["SOLANA"]["RPC_ENDPOINT"];
  public connection = new Connection(this.rpcEndpoint, "confirmed");
  public slippage = userSettings["SOLANA"]["SLIPPAGE"];
  private database = database;
  public wallet!: Keypair;
  public prices!: TPrices;

  private constructor() {}

  public static async getInstance(): Promise<SolanaService> {
    if (!SolanaService.instance) {
      const service = new SolanaService();
      await service.init();
      SolanaService.instance = service;
    }
    return SolanaService.instance;
  }

  private async init() {
    this.wallet = await this.loadKeypair();
    await this.getPrices();
  }

  private getPrices = async () => {
    const { data } = await axios.get(
      `https://pools-api.mainnet.orca.so/prices`
    );
    this.prices = data.data;
    return data.data;
  };

  getAllBalances = async () => {
    await this.getPrices();
    const solBalance = await this.connection.getBalance(this.wallet.publicKey);

    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      this.wallet.publicKey,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    const balances = tokenAccounts.value
      .filter(
        (account) =>
          account.account.data.parsed.info.tokenAmount.uiAmount > 0 &&
          account.account.data.parsed.info.tokenAmount.decimals > 0
      )
      .map((account) => ({
        mint: account.account.data.parsed.info.mint,
        humanAmount: account.account.data.parsed.info.tokenAmount.uiAmount,
        amount: parseFloat(account.account.data.parsed.info.tokenAmount.amount),
        decimals: account.account.data.parsed.info.tokenAmount.decimals,
        amountUSD: parseFloat(
          (
            parseFloat(this.prices[account.account.data.parsed.info.mint]) *
            parseFloat(account.account.data.parsed.info.tokenAmount.uiAmount)
          ).toFixed(2)
        ),
      }));

    const solHumanAmount = solBalance / LAMPORTS_PER_SOL;

    balances.push({
      mint: config.SOL_MINT,
      humanAmount: solBalance / LAMPORTS_PER_SOL,
      amount: solBalance,
      decimals: 9,
      amountUSD: parseFloat(
        (parseFloat(this.prices[config.SOL_MINT]) * solHumanAmount).toFixed(2)
      ),
    });

    await this.database.addBalance(balances);

    return balances;
  };

  private async loadKeypair() {
    const secretBytes = Uint8Array.from(
      bs58.decode(userSettings["SOLANA"]["SECRET_KEY"])
    );
    const secretKey = Uint8Array.from(secretBytes);
    return Keypair.fromSecretKey(secretKey);
  }
}

export default SolanaService;
