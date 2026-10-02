import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { Card } from "@/components/ui/card"
import { LineChart, BarChart3, Wallet, ShieldCheck } from "lucide-react"

export function TradingExperience() {
  const features = [
    {
      title: "Advanced Trading",
      desc: "Real-time charts, order books, order types and market information.",
      icon: <LineChart className="w-5 h-5 text-[var(--brand-foreground)]" />,
      cta: "Explore Trading",
    },
    {
      title: "Real-Time Markets",
      desc: "Monitor digital assets and market movements in one place.",
      icon: <BarChart3 className="w-5 h-5 text-[var(--brand-foreground)]" />,
      cta: "View Markets",
    },
    {
      title: "Portfolio & Wallet",
      desc: "Manage supported assets and monitor balances.",
      icon: <Wallet className="w-5 h-5 text-[var(--brand-foreground)]" />,
      cta: "Explore Assets",
    },
    {
      title: "Risk Controls",
      desc: "Account security, transaction controls and configurable protection mechanisms.",
      icon: <ShieldCheck className="w-5 h-5 text-[var(--brand-foreground)]" />,
      cta: "Learn About Security",
    },
  ]

  return (
    <section className="bg-background py-24">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-6">
            Everything You Need to Trade With Confidence
          </h2>
          <p className="text-muted-foreground text-lg">
            A professional trading environment designed around real-time market data, intuitive controls, and disciplined execution.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
          {features.map((feature, i) => (
            <Card key={i} className="bg-card border-border p-6 hover:border-primary/20 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-foreground/5 flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
              <p className="text-muted-foreground text-sm mb-6 flex-1 min-h-[60px]">{feature.desc}</p>
              
            </Card>
          ))}
        </div>

        {/* Trading Terminal Showcase */}
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h3 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
              Professional Trading Terminal
            </h3>
            <p className="text-muted-foreground text-lg mb-8">
              Access the markets through a robust interface designed for speed and reliability.
            </p>
            <ul className="space-y-4 mb-8">
              {['Real-time order book', 'Professional charts', 'Multiple order types', 'Portfolio visibility', 'Live market updates'].map((item, i) => (
                <li key={i} className="flex items-center text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-success/20 text-success flex items-center justify-center mr-3 text-xs">✓</div>
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="w-full sm:w-auto px-8" asChild>
                
              </Button>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute -inset-4 bg-[radial-gradient(circle_at_center,rgba(20,91,140,0.28)_0%,transparent_70%)] rounded-3xl blur-xl pointer-events-none" />
            <div className="relative rounded-2xl border border-border bg-muted overflow-hidden shadow-2xl aspect-square sm:aspect-[4/3] flex flex-col">
              {/* Mock Terminal Header */}
              <div className="h-12 border-b border-border flex items-center px-4 bg-card justify-between">
                <div className="flex gap-4">
                  <span className="text-foreground font-medium text-sm">BTC/USDT</span>
                  <span className="text-success font-mono text-sm">$104,284.32</span>
                </div>
                <div className="flex gap-2">
                  <div className="w-16 h-6 rounded bg-danger/20 flex items-center justify-center text-danger text-xs font-medium">Sell</div>
                  <div className="w-16 h-6 rounded bg-success/20 flex items-center justify-center text-success text-xs font-medium">Buy</div>
                </div>
              </div>
              {/* Mock Terminal Body */}
              <div className="flex-1 flex flex-col sm:flex-row">
                <div className="flex-1 border-b sm:border-b-0 sm:border-r border-border p-4 flex flex-col">
                  {/* Chart area */}
                  <div className="flex-1 border-b border-border mb-4 relative flex items-end min-h-[100px]">
                    <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">

                      {[...Array(20)].map((_, i) => (
                        <rect key={i} x={i * 5 + 2} y={20 + Math.random() * 20} width="2" height={10 + Math.random() * 15} fill={Math.random() > 0.5 ? '#16A34A' : '#DC2626'} />
                      ))}
                    </svg>
                  </div>
                  {/* Orders area */}
                  <div className="h-1/3 sm:h-1/3">
                    <div className="h-3 w-24 bg-foreground/10 rounded mb-2" />
                    <div className="h-3 w-full bg-foreground/5 rounded mb-2" />
                    <div className="h-3 w-full bg-foreground/5 rounded mb-2" />
                  </div>
                </div>
                <div className="w-full sm:w-48 p-4">
                  {/* Order book area */}
                  <div className="h-3 w-16 bg-foreground/10 rounded mb-4" />
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex justify-between mb-2">
                      <span className="text-danger text-xs font-mono">104,{300 + i * 10}</span>
                      <span className="text-muted-foreground/70 text-xs font-mono">0.{i}5</span>
                    </div>
                  ))}
                  <div className="my-4 text-foreground font-mono text-sm text-center">104,284.32</div>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex justify-between mb-2">
                      <span className="text-success text-xs font-mono">104,{200 - i * 10}</span>
                      <span className="text-muted-foreground/70 text-xs font-mono">0.{i}2</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
