"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { apiClient } from "@ethsltd/api-client"

export function MarketsTable() {
  const [markets, setMarkets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true;
    apiClient.getMarkets().then(res => {
      if (res.success && mounted && res.data) {
        const formatted = res.data.map((m: any) => ({
          asset: m.baseAsset,
          quote: m.quoteAsset,
          name: m.name || m.baseAsset,
          price: `$${m.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
          change: `${m.priceChange24h >= 0 ? '+' : ''}${m.priceChange24h.toFixed(2)}%`,
          high: `$${m.high24h.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          low: `$${m.low24h.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          vol: `$${(m.volume24h * m.price).toLocaleString(undefined, { notation: "compact", compactDisplay: "short" })}`,
          up: m.priceChange24h >= 0
        }));
        setMarkets(formatted);
      }
    }).catch(console.error).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; }
  }, []);

  return (
    <section className="bg-muted py-24">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8">
        <div className="mb-12">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
            Explore the Markets
          </h2>
          <p className="text-muted-foreground text-lg">
            Track the digital assets and trading pairs available through ETHSLTD.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No active markets currently available.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-sm font-medium text-muted-foreground">
                    <th className="pb-4 font-medium pl-4">Asset</th>
                    <th className="pb-4 font-medium">Price</th>
                    <th className="pb-4 font-medium">24h Change</th>
                    <th className="pb-4 font-medium">24h High</th>
                    <th className="pb-4 font-medium">24h Low</th>
                    <th className="pb-4 font-medium">24h Volume</th>
                    <th className="pb-4 font-medium text-right pr-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {markets.map((market, i) => (
                    <tr key={i} className="border-b border-border hover:bg-foreground/[0.02] transition-colors">
                      <td className="py-4 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center font-bold text-xs">
                            {market.asset[0]}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{market.asset}/{market.quote}</div>
                            <div className="text-xs text-muted-foreground">{market.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 font-mono text-foreground">{market.price}</td>
                      <td className={cn("py-4 font-mono font-medium", market.up ? "text-success" : "text-danger")}>
                        {market.change}
                      </td>
                      <td className="py-4 font-mono text-muted-foreground/90">{market.high}</td>
                      <td className="py-4 font-mono text-muted-foreground/90">{market.low}</td>
                      <td className="py-4 font-mono text-muted-foreground/90">{market.vol}</td>
                      <td className="py-4 text-right pr-4">
                        <Button variant="outline" size="sm" className="border-border hover:bg-foreground/10" asChild>
                          
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {markets.map((market, i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center font-bold text-xs">
                        {market.asset[0]}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{market.asset}/{market.quote}</div>
                        <div className="text-xs text-muted-foreground">{market.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-foreground font-medium">{market.price}</div>
                      <div className={cn("text-xs font-mono font-medium", market.up ? "text-success" : "text-danger")}>
                        {market.change}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-border flex-wrap gap-y-4">
                    <div>
                      <div className="text-xs text-muted-foreground">24h Volume</div>
                      <div className="font-mono text-sm text-muted-foreground/90">{market.vol}</div>
                    </div>
                    <Button variant="outline" size="sm" className="border-border" asChild>
                      
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
