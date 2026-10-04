"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@ethsltd/api-client";
import { P2PAdvertisement, P2PMerchant } from "@/lib/p2p/types";
import { useP2PStore } from "@/stores/p2p-store";
import { useCurrencies } from "@/hooks/use-currencies";
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";


export function P2PTable({ onSelectAd }: { onSelectAd: (ad: P2PAdvertisement, merchant: P2PMerchant) => void }) {
  const { fiats } = useCurrencies();
  const { query } = useP2PStore();

  const [ads, setAds] = useState<P2PAdvertisement[]>([]);
  const [merchants, setMerchants] = useState<Record<string, P2PMerchant>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.getP2pAds();
        if (res.success && res.data) {
          // Filter ads based on query locally for MVP
          const filteredAds = res.data.filter((ad: any) => {
            const requiredAdType = query.side === "buy" ? "sell" : "buy";
            const typeMatch = ad.type.toLowerCase() === requiredAdType;
            const assetMatch = query.asset === 'all' || ad.asset === query.asset;
            const fiatMatch = query.fiat === 'all' || ad.fiat === query.fiat;
            
            let amountMatch = true;
            if (query.amount && query.amount > 0) {
              const amount = Number(query.amount);
              amountMatch = amount >= Number(ad.minLimit) && amount <= Number(ad.maxLimit);
            }

            let paymentMatch = true;
            if (query.paymentMethod && query.paymentMethod !== 'all') {
              let pm = ad.paymentMethods;
              if (typeof pm === 'string') {
                try { pm = JSON.parse(pm); } catch(e) { pm = []; }
              }
              if (!Array.isArray(pm)) pm = [];
              paymentMatch = pm.some((method: any) => {
                const typeStr = typeof method === 'string' ? method : (method.type || '');
                const normalizedType = typeStr.toLowerCase().replace(/_/g, ' ');
                const normalizedQuery = (query.paymentMethod || '').toLowerCase().replace(/_/g, ' ');
                return normalizedType === normalizedQuery || normalizedType.includes(normalizedQuery) || normalizedQuery.includes(normalizedType);
              });
            }

            return typeMatch && assetMatch && fiatMatch && amountMatch && paymentMatch;
          });
          setAds(filteredAds);
          
          const newMerchants: Record<string, P2PMerchant> = {};
          for (const ad of filteredAds) {
            const mId = ad.userId || ad.merchant?.id || ad.merchantId;
            if (mId) {
              newMerchants[mId] = ad.merchant;
            }
          }
          setMerchants(newMerchants);
        }
      } catch(e) {
        console.error(e)
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [query]);

  const isBuyMode = query.side === "buy";
  
  const fiatSymbol = fiats.find(f => f.code === query.fiat)?.symbol || "$";

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-6 py-4 text-xs font-medium text-muted-foreground">Merchant</th>
              <th className="px-6 py-4 text-xs font-medium text-muted-foreground">Price</th>
              <th className="px-6 py-4 text-xs font-medium text-muted-foreground">Available / Limits</th>
              <th className="px-6 py-4 text-xs font-medium text-muted-foreground">Payment</th>
              <th className="px-6 py-4 text-xs font-medium text-muted-foreground text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
                </td>
              </tr>
            ) : ads.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <div className="text-muted-foreground mb-2">No offers match your criteria.</div>
                  <Button variant="outline" size="sm">Reset Filters</Button>
                </td>
              </tr>
            ) : (
              ads.map((ad: any) => {
                const merchantId = ad.userId || ad.merchant?.id || ad.merchantId || "unknown";
                const merchant = ad.merchant || merchants[merchantId] || {
                  id: merchantId,
                  displayName: merchantId,
                  verified: false,
                  completionRate: 100,
                };
                
                const currentFiatSymbol = fiats.find(f => f.code === ad.fiat)?.symbol || (ad.fiat === 'INR' ? '₹' : (ad.fiat === 'USD' ? '$' : ad.fiat));
                
                // Ensure paymentMethods is an array of strings
                let pm = ad.paymentMethods || [];
                if (typeof pm === 'string') {
                  try { pm = JSON.parse(pm); } catch(e) { pm = [pm]; }
                }
                if (!Array.isArray(pm)) pm = [];

                return (
                  <tr key={ad.id} className="hover:bg-muted/30 transition-colors">
                    {/* Merchant Column */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary dark:bg-primary/10 text-primary dark:text-primary font-bold flex items-center justify-center text-sm">
                          {merchant.displayName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{merchant.displayName}</span>
                            {merchant.verified && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{merchant.completionRate}% completion</span>
                            <span>•</span>
                            <span>{merchant.totalOrders} orders</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Price Column */}
                    <td className="px-6 py-5">
                      <div className="font-display text-xl font-bold text-foreground">
                        {currentFiatSymbol}{Number(ad.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {ad.fiat} / {ad.asset}
                      </div>
                    </td>

                    {/* Limits Column */}
                    <td className="px-6 py-5 space-y-1.5 whitespace-nowrap">
                      <div className="flex items-center text-sm gap-4">
                        <span className="text-muted-foreground w-16">Available</span>
                        <span className="font-mono text-foreground font-medium">{Number(ad.availableAmount).toLocaleString()} {ad.asset}</span>
                      </div>
                      <div className="flex items-center text-sm gap-4">
                        <span className="text-muted-foreground w-16">Limit</span>
                        <span className="font-mono text-foreground">{currentFiatSymbol}{Number(ad.minLimit).toLocaleString()} - {currentFiatSymbol}{Number(ad.maxLimit).toLocaleString()}</span>
                      </div>
                    </td>

                    {/* Payment Column */}
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                        {pm.slice(0, 3).map((methodObj: any, idx: number) => {
                          const methodName = typeof methodObj === 'string' 
                            ? methodObj 
                            : (methodObj?.type || 'Unknown');
                            
                          const methodKey = typeof methodObj === 'string' ? methodObj : (methodObj?.id || String(idx));
                          
                          return (
                            <span key={methodKey} className="px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-md border border-border">
                              {String(methodName).replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          );
                        })}
                        {pm.length > 3 && (
                          <span className="px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-md border border-border">
                            +{pm.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action Column */}
                    <td className="px-6 py-5 text-right">
                      <Button 
                        variant={query.side === "buy" ? "default" : "destructive"} 
                        onClick={() => onSelectAd(ad, merchant)}
                      >
                        {query.side === "buy" ? 'Buy' : 'Sell'}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
