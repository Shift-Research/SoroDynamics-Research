import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soroban State Dynamics Hub",
  description:
    "Dashboard for monitoring dynamic token supply mechanics, slippage metrics, and simulated arbitrage windows on Stellar / Soroban.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-white">
              ⚡ Soroban State Dynamics Hub
            </h1>
            <span className="text-sm text-gray-400">
              Stellar Testnet · Dynamic Supply
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
