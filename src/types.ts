export type TPrices = {
  [publicKey: string]: string;
};

export type TPoolData = {
  address: string;
  whirlpoolsConfig: string;
  whirlpoolBump: number[];
  tickSpacing: number;
  tickSpacingSeed: number[];
  feeRate: number;
  protocolFeeRate: number;
  liquidity: string;
  sqrtPrice: string;
  tickCurrentIndex: number;
  protocolFeeOwedA: string;
  protocolFeeOwedB: string;
  tokenMintA: string;
  tokenVaultA: string;
  feeGrowthGlobalA: string;
  tokenMintB: string;
  tokenVaultB: string;
  feeGrowthGlobalB: string;
  rewardLastUpdatedTimestamp: string;
  updatedAt: string;
  updatedSlot: number;
  writeVersion: number;
  hasWarning: boolean;
  poolType: string;
  tokenA: {
    address: string;
    programId: string;
    imageUrl: string;
    name: string;
    symbol: string;
    decimals: number;
    tags: string[];
  };
  tokenB: {
    address: string;
    programId: string;
    imageUrl: string;
    name: string;
    symbol: string;
    decimals: number;
    tags: string[];
  };
  price: string;
  tvlUsdc: string;
  yieldOverTvl: string;
  tokenBalanceA: string;
  tokenBalanceB: string;
  stats: {
    "24h": {
      volume: string;
      fees: string;
      rewards: string;
    };
    "7d": {
      volume: string;
      fees: string;
      rewards: string;
    };
    "30d": {
      volume: string;
      fees: string;
      rewards: string;
    };
  };
  rewards: Array<{
    mint: string;
    vault: string;
    authority: string;
    emissions_per_second_x64: string;
    growth_global_x64: string;
    active: boolean;
    emissionsPerSecond: string;
  }>;
  lockedLiquidityPercent: any[]; // Se precisar de mais detalhe, substitua `any[]` pelo tipo correto
};

export type TPositionData = {
  positionMint: string;
  positionId: string;
  poolAddress: string;
  tokenAAddress: string;
  tokenBAddress: string;
  price: number;
  tickLowerIndex: number;
  tickUpperIndex: number;
  lowerPrice: number;
  upperPrice: number;
  amountTokenA: number;
  amountTokenB: number;
  amountTokenAUsd: number;
  amountTokenBUSD: number;
  amountPositionUsd: number;
  inRange: boolean;
};
