import {
  buildDefaultAccountFetcher,
  buildWhirlpoolClient,
  decreaseLiquidityQuoteByLiquidityWithParams,
  increaseLiquidityQuoteByInputTokenWithParams,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil,
  PoolUtil,
  PriceMath,
  TokenExtensionUtil,
  WhirlpoolClient,
  WhirlpoolContext,
  WhirlpoolIx,
} from "@orca-so/whirlpools-sdk";
import {
  DecimalUtil,
  EMPTY_INSTRUCTION,
  Percentage,
  resolveOrCreateATA,
  TransactionBuilder,
} from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import axios from "axios";
import { AnchorProvider, BN, Instruction, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TPoolData, TPositionData } from "../../../../types";
import { database } from "../../../../services/database.service";
import SolanaService from "../../chain/solana/solana.service";

import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  unpackAccount,
} from "@solana/spl-token";
import { userSettings } from "../../../../settingsData";

type PoolRes = {
  address: string;
  tokenA: {
    address: string;
    name: string;
    symbol: string;
    decimals: string;
  };
  tokenB: {
    address: string;
    name: string;
    symbol: string;
    decimals: string;
  };
  price: string;
};

export default class OrcaService {
  private static instance: OrcaService;
  private solanaService!: SolanaService;
  private connection!: Connection;
  private wallet!: Keypair;
  private provider!: AnchorProvider;
  private ctx!: WhirlpoolContext;
  private client!: WhirlpoolClient;

  constructor() {}

  public static async getInstance(): Promise<OrcaService> {
    if (!OrcaService.instance) {
      const service = new OrcaService();
      await service.init();
      OrcaService.instance = service;
    }
    return OrcaService.instance;
  }

  private async init() {
    this.solanaService = await SolanaService.getInstance();
    this.connection = this.solanaService.connection;
    this.wallet = this.solanaService.wallet;
    this.provider = new AnchorProvider(
      this.connection,
      new Wallet(this.wallet),
      {}
    );
    this.ctx = WhirlpoolContext.withProvider(
      this.provider,
      ORCA_WHIRLPOOL_PROGRAM_ID
    );
    this.client = buildWhirlpoolClient(this.ctx);
  }

  private getPoolByAddress = async (poolAddress: string) => {
    const { data } = await axios.get(
      `https://api.orca.so/v2/solana/pools/${poolAddress}`
    );
    return data.data as any;
  };

  public fetchPools = async () => {
    const { data } = await axios.get(
      "https://api.orca.so/v2/solana/pools?sortBy=volume&sortDirection=desc&limit=50"
    );
    return data.data as TPoolData[];
  };

  private async getPoolsNFT() {
    const payload = {
      id: "text",
      jsonrpc: "2.0",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: this.solanaService.wallet.publicKey.toBase58(),
        page: 1,
        limit: 100,
      },
    };
    const { data } = await axios.post(this.solanaService.rpcEndpoint, payload);
    // Filtra apenas os itens cujo metadata indica "OWP"
    const results = data.result.items.filter(
      (e: any) => e.content.metadata.symbol === "OWP"
    );
    return results;
  }

  public getOpenPositions = async () => {
    const poolsNFT = await this.getPoolsNFT();
    let positionIds = poolsNFT.map(
      (token: any) => token.mint_extensions.mint_close_authority.close_authority
    );
    const tokenAccounts = (
      await this.ctx.connection.getTokenAccountsByOwner(
        this.ctx.wallet.publicKey,
        { programId: TOKEN_PROGRAM_ID }
      )
    ).value;

    tokenAccounts
      .map((ta) => {
        const parsed = unpackAccount(ta.pubkey, ta.account);
        const pda = PDAUtil.getPosition(
          this.ctx.program.programId,
          parsed.mint
        );
        return new BN(parsed.amount.toString()).eq(new BN(1))
          ? pda.publicKey
          : undefined;
      })
      .filter((pubkey) => pubkey !== undefined)
      .forEach((pubkey) => positionIds.push(pubkey.toString()));

    positionIds = [...new Set(positionIds)];

    const positions: TPositionData[] = [];
    for (let i = 0; i < positionIds.length; i++) {
      const positionId = positionIds[i];
      let position;
      try {
        position = await this.client.getPosition(positionId);
      } catch (error) {
        continue;
      }
      const data = position.getData();
      const pool = await this.client.getPool(data.whirlpool);
      const tokenA = pool.getTokenAInfo();
      const tokenB = pool.getTokenBInfo();
      const poolData = pool.getData();

      const price = PriceMath.sqrtPriceX64ToPrice(
        poolData.sqrtPrice,
        tokenA.decimals,
        tokenB.decimals
      );
      const lowerPrice = PriceMath.tickIndexToPrice(
        data.tickLowerIndex,
        tokenA.decimals,
        tokenB.decimals
      );
      const upperPrice = PriceMath.tickIndexToPrice(
        data.tickUpperIndex,
        tokenA.decimals,
        tokenB.decimals
      );
      const amounts = PoolUtil.getTokenAmountsFromLiquidity(
        data.liquidity,
        pool.getData().sqrtPrice,
        PriceMath.tickIndexToSqrtPriceX64(data.tickLowerIndex),
        PriceMath.tickIndexToSqrtPriceX64(data.tickUpperIndex),
        true
      );
      const positionMint = data.positionMint.toString();
      const poolAddress = data.whirlpool.toString();
      const tokenAAddress = tokenA.mint.toString();
      const tokenBAddress = tokenB.mint.toString();
      const humanPrice = parseFloat(price.toFixed(tokenB.decimals));
      const humanLowerPrice = parseFloat(lowerPrice.toFixed(tokenB.decimals));
      const humanUpperPrice = parseFloat(upperPrice.toFixed(tokenB.decimals));
      const humanAmountTokenA = parseFloat(
        DecimalUtil.fromBN(amounts.tokenA, tokenA.decimals).toString()
      );
      const humanAmountTokenB = parseFloat(
        DecimalUtil.fromBN(amounts.tokenB, tokenB.decimals).toString()
      );
      const inRange =
        humanPrice >= humanLowerPrice && humanPrice <= humanUpperPrice;

      const amountTokenAUsd = parseFloat(
        (
          parseFloat(this.solanaService.prices[tokenAAddress]) *
          humanAmountTokenA
        ).toFixed(2)
      );
      const amountTokenBUSD = parseFloat(
        (
          parseFloat(this.solanaService.prices[tokenBAddress]) *
          humanAmountTokenB
        ).toFixed(2)
      );

      const amountPositionUsd = parseFloat(
        (amountTokenAUsd + amountTokenBUSD).toFixed(2)
      );

      positions.push({
        positionMint,
        positionId,
        poolAddress,
        tokenAAddress,
        tokenBAddress,
        price: humanPrice,
        tickLowerIndex: data.tickLowerIndex,
        tickUpperIndex: data.tickUpperIndex,
        lowerPrice: humanLowerPrice,
        upperPrice: humanUpperPrice,
        amountTokenA: humanAmountTokenA,
        amountTokenB: humanAmountTokenB,
        amountTokenAUsd,
        amountTokenBUSD,
        amountPositionUsd,
        inRange,
      });
    }

    return positions;
  };

  public async estimatePosition(
    poolAddress: string,
    rangePercent: number,
    baseTokenMint: string,
    baseTokenAmount: number
  ) {
    const whirlpool = await this.client.getPool(poolAddress);
    const tokenA = whirlpool.getTokenAInfo();
    const tokenB = whirlpool.getTokenBInfo();
    const whirlpoolData = whirlpool.getData();

    const baseToken =
      baseTokenMint === tokenA.address.toBase58() ? tokenA : tokenB;

    console.log(
      `ESTIMATING POOL -> ${baseTokenMint} = ${DecimalUtil.fromBN(
        baseTokenAmount,
        baseToken.decimals
      )}`
    );

    const sqrtPriceX64 = whirlpool.getData().sqrtPrice;

    const price = PriceMath.sqrtPriceX64ToPrice(
      sqrtPriceX64,
      tokenA.decimals,
      tokenB.decimals
    );

    const { lowerPrice: validLowerPrice, upperPrice: validUpperPrice } =
      this.getValidPriceRange(
        price,
        rangePercent,
        tokenA.decimals,
        tokenB.decimals,
        whirlpoolData.tickSpacing
      );

    const rangeBelowPercent = price.minus(validLowerPrice).div(price).mul(100);
    const rangeAbovePercent = validUpperPrice.minus(price).div(price).mul(100);

    console.log(
      `POOL RANGE ≈ -${rangeBelowPercent.toFixed(
        2
      )}% / +${rangeAbovePercent.toFixed(
        2
      )}% AROUND CURRENT PRICE ${price.toFixed(tokenB.decimals)}`
    );

    const slippagePercent = Number(userSettings["SOLANA"]["SLIPPAGE"] || "2");

    const lowerTickIndex = PriceMath.priceToInitializableTickIndex(
      validLowerPrice,
      tokenA.decimals,
      tokenB.decimals,
      whirlpoolData.tickSpacing
    );
    const upperTickIndex = PriceMath.priceToInitializableTickIndex(
      validUpperPrice,
      tokenA.decimals,
      tokenB.decimals,
      whirlpoolData.tickSpacing
    );

    const quote = increaseLiquidityQuoteByInputTokenWithParams({
      tokenMintA: tokenA.mint,
      tokenMintB: tokenB.mint,
      sqrtPrice: whirlpoolData.sqrtPrice,
      tickCurrentIndex: whirlpoolData.tickCurrentIndex,
      tickLowerIndex: lowerTickIndex,
      tickUpperIndex: upperTickIndex,
      inputTokenMint: baseToken.address,
      inputTokenAmount: new BN(baseTokenAmount),
      slippageTolerance: Percentage.fromFraction(slippagePercent, 100),
      tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(
        this.ctx.fetcher,
        whirlpoolData
      ),
    });

    const positionQuote = await whirlpool.openPositionWithMetadata(
      lowerTickIndex,
      upperTickIndex,
      quote
    );

    console.log(
      `I WILL NEED -> ${tokenA.address.toString()} = ${DecimalUtil.fromBN(
        quote.tokenMaxA,
        tokenA.decimals
      )} (${quote.tokenMaxA})`
    );

    console.log(
      `I WILL NEED -> ${tokenB.address.toString()} = ${DecimalUtil.fromBN(
        quote.tokenMaxB,
        tokenB.decimals
      )}  (${quote.tokenMaxB})`
    );

    return {
      amountTokenA: quote.tokenMaxA,
      amountTokenB: quote.tokenMaxB,
      positionQuote,
      tokenA,
      tokenB,
      rangePercent,
    };
  }

  private getValidPriceRange(
    currentPrice: Decimal,
    rangePercent: number,
    tokenADecimals: number,
    tokenBDecimals: number,
    tickSpacing: number
  ): { lowerPrice: Decimal; upperPrice: Decimal } {
    // Calcula os limites "naïve" usando rangePercent
    const naiveLowerPrice = currentPrice.mul(
      new Decimal(1 - rangePercent / 100)
    );
    const naiveUpperPrice = currentPrice.mul(
      new Decimal(1 + rangePercent / 100)
    );

    // Converte os preços "naïve" para tick indices válidos usando o método do SDK
    const lowerTickIndex = PriceMath.priceToInitializableTickIndex(
      naiveLowerPrice,
      tokenADecimals,
      tokenBDecimals,
      tickSpacing
    );
    const upperTickIndex = PriceMath.priceToInitializableTickIndex(
      naiveUpperPrice,
      tokenADecimals,
      tokenBDecimals,
      tickSpacing
    );

    // Converte os tick indices para preços, "snapando" os valores para os ticks válidos
    const validLowerPrice = PriceMath.tickIndexToPrice(
      lowerTickIndex,
      tokenADecimals,
      tokenBDecimals
    );
    const validUpperPrice = PriceMath.tickIndexToPrice(
      upperTickIndex,
      tokenADecimals,
      tokenBDecimals
    );

    return {
      lowerPrice: validLowerPrice,
      upperPrice: validUpperPrice,
    };
  }

  public executePosition = async (
    positionQuote: any,
    tokenA: any,
    tokenB: any,
    rangePercent: number,
    isMock = false
  ) => {
    if (isMock) return "FAKE POSITION MINT";

    const signature = await positionQuote.tx.buildAndExecute();
    const latestBlockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction(
      { signature, ...latestBlockhash },
      "confirmed"
    );
    const positionMint = positionQuote.positionMint.toBase58();

    const positions = await this.getOpenPositions();

    const position = positions.find((p) => p.positionMint === positionMint);

    const usdAmount = parseFloat(
      (
        (position?.amountTokenAUsd || 0) + (position?.amountTokenBUSD || 0)
      ).toFixed(2)
    );

    const tokenAAmountUsd = parseFloat(
      position?.amountTokenAUsd.toFixed(2) || "0"
    );
    const tokenBAmountUsd = parseFloat(
      position?.amountTokenBUSD.toFixed(2) || "0"
    );

    database.addPosition({
      isOpen: true,
      positionMint,
      signature,
      tokenAMint: tokenA.address.toString(),
      tokenBMint: tokenB.address.toString(),
      tokenAAmount: position?.amountTokenA,
      tokenBAmount: position?.amountTokenB,
      tokenAAmountUsd,
      tokenBAmountUsd,
      rangePercent,
      usdAmount,
      updates: [
        {
          date: new Date(),
          tokenAAmountUsd,
          tokenBAmountUsd,
          usdAmount,
          usdPNL: 0,
          usdPercentPNL: 0,
          peakUsdAmount: usdAmount,
          stopTrailingUsd: usdAmount,
          stopTrailingPercent: 0,
        },
      ],
    });
    return positionMint;
  };

  public async closePositionByPositionId(positionMint: string) {
    const position_pubkey = new PublicKey(positionMint);
    console.log("closing position:", position_pubkey.toBase58());

    // Set acceptable slippage
    const slippage = Percentage.fromFraction(
      userSettings["SOLANA"]["SLIPPAGE"],
      100
    ); // 1%

    // Get the position and the pool to which the position belongs
    const position = await this.client.getPosition(position_pubkey);
    const position_owner = this.ctx.wallet.publicKey;
    const position_token_account = getAssociatedTokenAddressSync(
      position.getData().positionMint,
      position_owner
    );
    const whirlpool_pubkey = position.getData().whirlpool;
    const whirlpool = await this.client.getPool(whirlpool_pubkey);
    const whirlpool_data = whirlpool.getData();

    const token_a = whirlpool.getTokenAInfo();
    const token_b = whirlpool.getTokenBInfo();

    // Get TickArray and Tick
    const tick_spacing = whirlpool.getData().tickSpacing;
    const tick_array_lower_pubkey = PDAUtil.getTickArrayFromTickIndex(
      position.getData().tickLowerIndex,
      tick_spacing,
      whirlpool_pubkey,
      this.ctx.program.programId
    ).publicKey;
    const tick_array_upper_pubkey = PDAUtil.getTickArrayFromTickIndex(
      position.getData().tickUpperIndex,
      tick_spacing,
      whirlpool_pubkey,
      this.ctx.program.programId
    ).publicKey;

    // Create token accounts to receive fees and rewards
    // Collect mint addresses of tokens to receive
    const tokens_to_be_collected = new Set<string>();
    tokens_to_be_collected.add(token_a.mint.toBase58());
    tokens_to_be_collected.add(token_b.mint.toBase58());
    whirlpool.getData().rewardInfos.map((reward_info) => {
      if (PoolUtil.isRewardInitialized(reward_info)) {
        tokens_to_be_collected.add(reward_info.mint.toBase58());
      }
    });
    // Get addresses of token accounts and get instructions to create if it does not exist
    const required_ta_ix: Instruction[] = [];
    const token_account_map = new Map<string, PublicKey>();
    for (let mint_b58 of tokens_to_be_collected) {
      const mint = new PublicKey(mint_b58);
      // If present, ix is EMPTY_INSTRUCTION
      const { address, ...ix } = await resolveOrCreateATA(
        this.ctx.connection,
        position_owner,
        mint,
        () => this.ctx.fetcher.getAccountRentExempt()
      );
      required_ta_ix.push(ix as unknown as Instruction);
      //required_ta_ix.push(ix);
      token_account_map.set(mint_b58, address);
    }

    // Build the instruction to update fees and rewards
    let update_fee_and_rewards_ix = WhirlpoolIx.updateFeesAndRewardsIx(
      this.ctx.program,
      {
        whirlpool: position.getData().whirlpool,
        position: position_pubkey,
        tickArrayLower: tick_array_lower_pubkey,
        tickArrayUpper: tick_array_upper_pubkey,
      }
    );

    const tokenOwnerAccountA = token_account_map.get(token_a.mint.toBase58());
    const tokenOwnerAccountB = token_account_map.get(token_b.mint.toBase58());

    if (!tokenOwnerAccountA || !tokenOwnerAccountB) {
      throw new Error("Token owner account não encontrado para um dos tokens");
    }

    // Build the instruction to collect fees
    let collect_fees_ix = WhirlpoolIx.collectFeesIx(this.ctx.program, {
      whirlpool: whirlpool_pubkey,
      position: position_pubkey,
      positionAuthority: position_owner,
      positionTokenAccount: position_token_account,
      tokenOwnerAccountA,
      tokenOwnerAccountB,
      tokenVaultA: whirlpool.getData().tokenVaultA,
      tokenVaultB: whirlpool.getData().tokenVaultB,
    });

    // Build the instructions to collect rewards
    const collect_reward_ix = [
      EMPTY_INSTRUCTION,
      EMPTY_INSTRUCTION,
      EMPTY_INSTRUCTION,
    ];

    for (let i = 0; i < whirlpool.getData().rewardInfos.length; i++) {
      const reward_info = whirlpool.getData().rewardInfos[i];
      if (!PoolUtil.isRewardInitialized(reward_info)) continue;

      const rewardOwnerAccount = token_account_map.get(
        reward_info.mint.toBase58()
      );

      if (!rewardOwnerAccount) {
        throw new Error("rewardOwnerAccount not found");
      }

      collect_reward_ix[i] = WhirlpoolIx.collectRewardIx(this.ctx.program, {
        whirlpool: whirlpool_pubkey,
        position: position_pubkey,
        positionAuthority: position_owner,
        positionTokenAccount: position_token_account,
        rewardIndex: i,
        rewardOwnerAccount,
        rewardVault: reward_info.vault,
      });
    }

    // Estimate the amount of tokens that can be withdrawn from the position
    const quote = decreaseLiquidityQuoteByLiquidityWithParams({
      // Pass the pool state as is
      sqrtPrice: whirlpool_data.sqrtPrice,
      tickCurrentIndex: whirlpool_data.tickCurrentIndex,
      // Pass the price range of the position as is
      tickLowerIndex: position.getData().tickLowerIndex,
      tickUpperIndex: position.getData().tickUpperIndex,
      // Liquidity to be withdrawn (All liquidity)
      liquidity: position.getData().liquidity,
      // Acceptable slippage
      slippageTolerance: slippage,
      // Get token info for TokenExtensions
      tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(
        this.ctx.fetcher,
        whirlpool_data
      ),
    });

    // Output the estimation
    console.log("ESTIMATION");
    console.log(
      DecimalUtil.fromBN(quote.tokenMinA, token_a.decimals).toFixed(
        token_a.decimals
      )
    );
    console.log(
      DecimalUtil.fromBN(quote.tokenMinB, token_b.decimals).toFixed(
        token_b.decimals
      )
    );

    // Build the instruction to decrease liquidity
    const decrease_liquidity_ix = WhirlpoolIx.decreaseLiquidityIx(
      this.ctx.program,
      {
        ...quote,
        whirlpool: whirlpool_pubkey,
        position: position_pubkey,
        positionAuthority: position_owner,
        positionTokenAccount: position_token_account,
        tokenOwnerAccountA,
        tokenOwnerAccountB,
        tokenVaultA: whirlpool.getData().tokenVaultA,
        tokenVaultB: whirlpool.getData().tokenVaultB,
        tickArrayLower: tick_array_lower_pubkey,
        tickArrayUpper: tick_array_upper_pubkey,
      }
    );

    // Build the instruction to close the position
    const close_position_ix = WhirlpoolIx.closePositionIx(this.ctx.program, {
      position: position_pubkey,
      positionAuthority: position_owner,
      positionTokenAccount: position_token_account,
      positionMint: position.getData().positionMint,
      receiver: position_owner,
    });

    // Create a transaction and add the instruction
    const tx_builder = new TransactionBuilder(
      this.ctx.connection,
      this.ctx.wallet
    );
    // Create token accounts
    required_ta_ix.map((ix) => tx_builder.addInstruction(ix as any));
    tx_builder
      // Update fees and rewards, collect fees, and collect rewards
      .addInstruction(update_fee_and_rewards_ix)
      .addInstruction(collect_fees_ix)
      .addInstruction(collect_reward_ix[0])
      .addInstruction(collect_reward_ix[1])
      .addInstruction(collect_reward_ix[2])
      // Decrease liquidity
      .addInstruction(decrease_liquidity_ix)
      // Close the position
      .addInstruction(close_position_ix);

    // Send the transaction
    const signature = await tx_builder.buildAndExecute();
    console.log("signature:", signature);

    // Wait for the transaction to complete
    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction(
      { signature, ...latest_blockhash },
      "confirmed"
    );
  }
}
