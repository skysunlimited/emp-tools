import { createContainer } from "unstated-next";
import { useState, useEffect } from "react";

import { useQuery } from "@apollo/client";
import { TOKENS, POOL } from "../apollo/balancer/queries";

interface PoolState {
  exitsCount: number;
  joinsCount: number;
  swapsCount: number;
  liquidity: number;
  swapFee: number;
  tokenBalanceEmp: number;
  tokenBalanceOther: number;
  totalSwapVolume: number;
}

interface SharesState {
  [address: string]: string;
}

interface SharesQuery {
  [address: string]: {
    id: string;
  };
}
interface PoolTokenQuery {
  address: string;
  balance: string;
}

const useBalancer = () => {
  // In the future, detect the EMP address dynamically. But, for now we are only going to load data for the yUSD pool.
  // I am hardcoding these for now so that this component can be rendered without the user having to select an EMP.
  const empAddress = "0x81ab848898b5ffd3354dbbefb333d5d183eedcb5";
  const usdcAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  const poolTokensList = [empAddress, usdcAddress];

  // Because apollo caches results of queries, we will poll/refresh this query periodically.
  // We set the poll interval to a very slow 5 seconds for now since the position states
  // are not expected to change much.
  // Source: https://www.apollographql.com/docs/react/data/queries/#polling
  const {
    loading: tokenPriceLoading,
    error: tokenPriceError,
    data: tokenPriceData,
  } = useQuery(TOKENS, {
    context: { clientName: "BALANCER" },
    variables: { tokenId: empAddress.toLowerCase() },
    pollInterval: 5000,
  });
  const { loading: poolLoading, error: poolError, data: poolData } = useQuery(
    POOL(JSON.stringify(poolTokensList.map((token) => token.toLowerCase()))),
    {
      context: { clientName: "BALANCER" },
      pollInterval: 5000,
    }
  );

  const [usdPrice, setUsdPrice] = useState<number | null>(null);
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [shares, setShares] = useState<SharesState | null>(null);

  const queryTokenData = () => {
    setUsdPrice(null);
    setPoolAddress(null);

    if (tokenPriceError) {
      console.error(
        `Apollo client failed to fetch graph data:`,
        tokenPriceError
      );
    }
    if (!tokenPriceLoading && tokenPriceData) {
      const data = tokenPriceData.tokenPrices[0];
      setUsdPrice(Number(data.price));
      const _poolAddress = data.poolTokenId.split("-")[0];
      // const _tokenAddress = data.poolTokenId.split("-")[1];
      setPoolAddress(_poolAddress);
    }
  };

  const queryPoolData = () => {
    setPool(null);
    setShares(null);

    if (poolError) {
      console.error(`Apollo client failed to fetch graph data:`, poolError);
    }
    if (!poolLoading && poolData) {
      const data = poolData.pools[0];

      const shareHolders: SharesState = {};
      data.shares.forEach((share: SharesQuery) => {
        if (!shareHolders[share.userAddress.id]) {
          shareHolders[share.userAddress.id] = share.userAddress.id;
        }
      });
      setShares(shareHolders);

      setPool({
        exitsCount: Number(data.exitsCount),
        joinsCount: Number(data.joinsCount),
        swapsCount: Number(data.swapsCount),
        liquidity: Number(data.liquidity),
        swapFee: Number(data.swapFee),
        tokenBalanceEmp: Number(
          data.tokens.find((t: PoolTokenQuery) => t.address === empAddress)
            .balance
        ),
        tokenBalanceOther: Number(
          data.tokens.find((t: PoolTokenQuery) => t.address === usdcAddress)
            .balance
        ),
        totalSwapVolume: Number(data.totalSwapVolume),
      });
    }
  };

  // Change state when emp changes or when the graphQL data changes due to polling.
  useEffect(() => {
    queryTokenData();
    queryPoolData();
  }, [tokenPriceData, tokenPriceLoading, poolData, poolLoading]);

  return {
    pool,
    poolAddress,
    usdPrice,
    shares,
  };
};

const Balancer = createContainer(useBalancer);

export default Balancer;