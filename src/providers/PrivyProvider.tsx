import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { base } from "viem/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { useState } from "react";

const wagmiConfig = createConfig({
  chains: [base],
  transports: { [base.id]: http() },
});

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID || "cmm1m68dw007c0clei81e66zy";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  if (!privyAppId) {
    return (
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    );
  }

  return (
    <BasePrivyProvider
      appId={privyAppId}
      config={{
        appearance: { theme: "dark", accentColor: "#c4956a" },
        defaultChain: base,
        supportedChains: [base],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </BasePrivyProvider>
  );
}