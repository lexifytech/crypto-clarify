import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { database } from "../../../../services/database.service";
import SolanaService from "../../chain/solana/solana.service";
import { config } from "../../../../config/config";

export default class JupiterService {
  private static instance: JupiterService;
  private solanaService!: SolanaService;
  private connection!: Connection;
  private wallet!: Keypair;
  private database = database;

  constructor() {}

  public static async getInstance(): Promise<JupiterService> {
    if (!JupiterService.instance) {
      const service = new JupiterService();
      await service.init();
      JupiterService.instance = service;
    }
    return JupiterService.instance;
  }

  private async init() {
    this.solanaService = await SolanaService.getInstance();
    this.connection = this.solanaService.connection;
    this.wallet = this.solanaService.wallet;
  }

  async estimateSwap(
    inputMint: string,
    outputMint: string,
    amount: number,
    considerAmountTokenOut: boolean = false
  ) {
    const inputMintData = await getMint(
      this.connection,
      new PublicKey(inputMint)
    );
    const outputMintData = await getMint(
      this.connection,
      new PublicKey(outputMint)
    );

    if (!inputMintData || !outputMintData || !amount) {
      throw new Error(
        "ERROR ESTIMATE SWAP: Invalid input or output mint or input token amount"
      );
    }

    let urlGet = `${config.JUPITER_QUOTE_API_URL}`;
    urlGet += `?inputMint=${inputMint}&outputMint=${outputMint}`;
    urlGet += `&amount=${amount}&slippageBps=${
      this.solanaService.slippage * 100
    }`;
    urlGet += `&swapMode=${considerAmountTokenOut ? "ExactOut" : "ExactIn"}`;

    const quoteResponseData = await fetch(urlGet);
    const quoteResponse = await quoteResponseData.json();

    if (quoteResponse?.error) {
      throw new Error("ERROR ESTIMATE SWAP:" + quoteResponse?.error);
    }

    console.log(
      "SWAPING USD VALUE:",
      inputMint,
      "->",
      outputMint,
      parseFloat(quoteResponse.swapUsdValue).toFixed(2)
    );

    const realInAmount =
      parseFloat(quoteResponse.inAmount) / 10 ** inputMintData.decimals;
    const realOutAmount =
      parseFloat(quoteResponse.outAmount) / 10 ** outputMintData.decimals;

    const swapReq = {
      inputMint,
      outputMint,
      humanInputTokenAmount: realInAmount,
      humanOutputTokenAmount: realOutAmount,
      inAmount: parseFloat(quoteResponse.inAmount),
      outAmount: parseFloat(quoteResponse.outAmount),
    };
    return { swapReq, quoteResponse };
  }

  async executeSwap({ swapReq, quoteResponse }: any) {
    const response = await fetch(`${config.JUPITER_SWAP_API_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: "auto",
        quoteResponse,
        userPublicKey: this.wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
      }),
    });

    const jsonResponse = await response.json();

    if (jsonResponse?.error || !jsonResponse?.swapTransaction) {
      throw new Error("ERROR EXECUTE SWAP:" + jsonResponse.error);
    }

    const transactionBase64 = jsonResponse.swapTransaction;

    const transaction = VersionedTransaction.deserialize(
      Buffer.from(transactionBase64, "base64")
    );

    transaction.sign([this.wallet]);

    const transactionBinary = transaction.serialize();

    const swapSignature = await this.connection.sendRawTransaction(
      transactionBinary,
      {
        maxRetries: 2,
        skipPreflight: true,
      }
    );

    const latestBlockHash = await this.connection.getLatestBlockhash();

    const confirmation = await this.connection.confirmTransaction(
      {
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: swapSignature,
      },
      "finalized"
    );

    if (confirmation.value.err) {
      throw new Error(
        `Transaction failed: ${JSON.stringify(
          confirmation.value.err
        )}\nhttps://solscan.io/tx/${swapSignature}/`
      );
    } else console.log(`SWAP DONE`);

    const swapRes = {
      inputMint: swapReq.inputMint,
      outputMint: swapReq.outputMint,
      inputTokenAmount: swapReq.humanInputTokenAmount,
      outputTokenAmount: swapReq.humanOutputTokenAmount,
      inAmount: swapReq.inAmount,
      outAmount: swapReq.outAmount,
      swapUsdValue: parseFloat(
        parseFloat(quoteResponse.swapUsdValue).toFixed(2)
      ),
      swapSignature,
    };

    await this.database.addSwap(swapRes);

    return swapRes;
  }
}
