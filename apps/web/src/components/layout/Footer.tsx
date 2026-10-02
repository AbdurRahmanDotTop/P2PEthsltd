import Link from "next/link"
import { Logo } from "@/components/ui/logo"

export function Footer() {
  return (
    <footer className="bg-background border-t border-border pt-16 pb-8">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 mb-12">
          <div className="col-span-2">
            <Link href="/" className="font-display font-bold text-2xl text-foreground tracking-tight mb-4 flex items-center gap-2">
              <Logo className="h-10 w-auto" />
            </Link>
            <p className="text-muted-foreground text-sm max-w-xs">
              The modern digital asset platform. Trade crypto with clarity and confidence.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-foreground mb-4">Trade</h4>
            <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li><Link href="/markets" className="hover:text-foreground transition-colors">Markets</Link></li>
              
              <li><Link href="/fees" className="hover:text-foreground transition-colors">Fees</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">P2P</h4>
            <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li><Link href="/p2p" className="hover:text-foreground transition-colors">P2P Marketplace</Link></li>
              <li><Link href="/p2p" className="hover:text-foreground transition-colors">Buy Crypto</Link></li>
              <li><Link href="/p2p" className="hover:text-foreground transition-colors">Sell Crypto</Link></li>
              <li><Link href="/support" className="hover:text-foreground transition-colors">Disputes</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Assets</h4>
            <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li><Link href="/markets" className="hover:text-foreground transition-colors">Supported Assets</Link></li>
              <li><Link href="/wallet" className="hover:text-foreground transition-colors">Wallet</Link></li>
              <li><Link href="/wallet/deposit" className="hover:text-foreground transition-colors">Deposits</Link></li>
              <li><Link href="/wallet/withdraw" className="hover:text-foreground transition-colors">Withdrawals</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Learn</h4>
            <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li><Link href="/learn/crypto-basics" className="hover:text-foreground transition-colors">Crypto Basics</Link></li>
              <li><Link href="/learn/trading" className="hover:text-foreground transition-colors">Trading Guide</Link></li>
              <li><Link href="/account/security" className="hover:text-foreground transition-colors">Security</Link></li>
              <li><Link href="/learn/market-insights" className="hover:text-foreground transition-colors">Market Insights</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-border text-xs text-muted-foreground">
          <p>© 2019 - {new Date().getFullYear()} ETHSLTD. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/legal/risk-disclosure" className="hover:text-foreground transition-colors">Risk Disclosure</Link>
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/legal/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
