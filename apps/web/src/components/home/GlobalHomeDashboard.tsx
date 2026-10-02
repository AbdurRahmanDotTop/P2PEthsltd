"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";
import { User, Bell, Download, Clock, CreditCard, Share2, MessageCircle, ShieldCheck, Globe } from "lucide-react";
import { apiClient } from "@ethsltd/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";

const heroSlides = [
  {
    id: 1,
    title: (
      <>
        Brand New Rates<br />
        <span className="text-yellow-400">0 Trading Fees</span><br />
        for Spot Trade!
      </>
    ),
    subtitle: "Fast & seamless professional trading experience.",
    bg: "bg-gradient-to-r from-blue-700 to-blue-500",
    cta: "Start Trading",
    
    bgElement: (
      <div className="absolute right-[-20px] top-0 bottom-0 flex items-center justify-center opacity-90 z-0">
        <span className="text-[120px] font-black text-yellow-500 leading-none drop-shadow-2xl italic">0</span>
      </div>
    )
  },
  {
    id: 2,
    title: (
      <>
        Buy & Sell Crypto<br />
        <span className="text-[#00C087]">Through P2P</span>
      </>
    ),
    subtitle: "Secure, escrow-protected direct user-to-user trading.",
    bg: "bg-gradient-to-r from-emerald-800 to-teal-600",
    cta: "Start P2P Trading",
    href: "/p2p",
    bgElement: (
      <div className="absolute right-[-10px] top-6 opacity-20 z-0 pointer-events-none">
        <CreditCard className="w-32 h-32 text-white transform rotate-12" />
      </div>
    )
  },
  {
    id: 3,
    title: (
      <>
        Your Crypto.<br />
        <span className="text-purple-400">Securely Managed.</span>
      </>
    ),
    subtitle: "Your assets remain protected with our secure wallet infrastructure.",
    bg: "bg-gradient-to-r from-purple-800 to-indigo-600",
    cta: "Explore Wallet",
    href: "/wallet",
    bgElement: (
      <div className="absolute right-[-10px] top-6 opacity-20 z-0 pointer-events-none">
        <ShieldCheck className="w-32 h-32 text-white transform -rotate-12" />
      </div>
    )
  },
  {
    id: 4,
    title: (
      <>
        Everything You Need<br />
        <span className="text-orange-400">For Your Journey</span>
      </>
    ),
    subtitle: "Trading, P2P, and portfolio management in one unified ecosystem.",
    bg: "bg-gradient-to-r from-orange-700 to-red-600",
    cta: "Get Started",
    
    bgElement: (
      <div className="absolute right-[-10px] top-6 opacity-20 z-0 pointer-events-none">
        <Globe className="w-32 h-32 text-white transform rotate-6" />
      </div>
    )
  }
];

export function GlobalHomeDashboard() {
  const [tickers, setTickers] = useState<any[]>([]);
  const { user } = useAuthStore();
  const router = useRouter();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  const minSwipeDistance = 50;

  useEffect(() => {
    let mounted = true;
    apiClient.getMarkets().then(res => {
      if (res.success && mounted && res.data) {
        setTickers(res.data);
      }
    }).catch(console.error);
    return () => { mounted = false; };
  }, []);

  // Auto-slide effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === heroSlides.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [currentSlide]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEndEvent = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      setCurrentSlide(prev => (prev === heroSlides.length - 1 ? 0 : prev + 1));
    } else if (isRightSwipe) {
      setCurrentSlide(prev => (prev === 0 ? heroSlides.length - 1 : prev - 1));
    }
  };

  const topMarkets = tickers.slice(0, 3);
  const gainers = [...tickers].sort((a, b) => b.priceChange24h - a.priceChange24h).slice(0, 5);

  const quickActions = [
    { name: "Deposit", icon: Download, href: "/wallet/deposit" },
    { name: "P2P", icon: CreditCard, href: "/p2p" },
    { name: "Share", icon: Share2, href: "/" },
    { name: "Chat", icon: MessageCircle, href: "/support" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] text-white font-sans w-full max-w-[1280px] mx-auto pb-20">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-4 mt-2">
        <button onClick={() => router.push('/account/profile')} className="w-8 h-8 rounded-full bg-[#00C087]/10 flex items-center justify-center text-[#00C087]">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
          ) : (
            <User className="w-5 h-5" />
          )}
        </button>
        <div className="flex items-center justify-center">
          <Logo className="h-10 sm:h-12 md:h-14 w-auto" />
        </div>
        <button onClick={() => router.push('/account/notifications')} className="relative p-1 text-[#00C087]">
          <Bell className="w-6 h-6" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#121212]" />
        </button>
      </div>

      {/* Hero Banner Carousel */}
      <div className="px-4 mt-2">
        <div 
          className="relative overflow-hidden rounded-xl shadow-lg h-[170px]" 
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEndEvent}
        >
          <div 
            className="flex h-full transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {heroSlides.map((slide) => (
              <div 
                key={slide.id} 
                className={`min-w-full h-full ${slide.bg} relative overflow-hidden flex flex-col justify-center px-5`}
              >
                {slide.bgElement}
                <div className="relative z-10 w-[75%] sm:w-2/3">
                  <h2 className="text-[17px] sm:text-xl font-bold leading-tight drop-shadow-md">{slide.title}</h2>
                  {slide.subtitle && (
                    <p className="text-[11px] sm:text-xs text-white/95 mt-1.5 line-clamp-2 pr-2">{slide.subtitle}</p>
                  )}
                  <Link href={slide.href} className="inline-block mt-3 bg-white text-black hover:bg-gray-100 text-[11px] sm:text-xs font-semibold px-4 py-1.5 rounded-full transition-colors shadow-sm">
                    {slide.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Carousel Indicators */}
        <div className="flex justify-center gap-1.5 mt-3">
          {heroSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentSlide === idx ? "w-4 bg-[#00C087]" : "w-1.5 bg-gray-600 hover:bg-gray-400"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Top Markets Grid */}
      <div className="grid grid-cols-3 gap-3 px-4 mt-6">
        {topMarkets.map((market, i) => (
          <div key={i} className="bg-[#1A1C24] rounded-lg p-3 flex flex-col items-center justify-center border border-white/5">
            <span className="text-xs font-medium text-gray-400">{market.symbol}</span>
            <span className={`text-lg font-bold mt-1 ${market.priceChange24h >= 0 ? 'text-[#00C087]' : 'text-red-500'}`}>
              {market.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
            </span>
            <span className={`text-[10px] mt-0.5 ${market.priceChange24h >= 0 ? 'text-[#00C087]' : 'text-red-500'}`}>
              {market.priceChange24h >= 0 ? '+' : ''}{market.priceChange24h.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-5 gap-2 px-2 mt-6">
        {quickActions.map((action, i) => {
          const Icon = action.icon;
          return (
            <Link key={i} href={action.href} className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#1A1C24] flex items-center justify-center text-[#00C087]">
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] text-gray-300">{action.name}</span>
            </Link>
          )
        })}
      </div>

    </div>
  );
}
