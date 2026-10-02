"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, LineChart, Zap, Wallet, CreditCard, ShoppingBag, Shield, BadgeDollarSign, HeadphonesIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function AppNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams?.get('tab');
  
  const [showP2pMenu, setShowP2pMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close submenu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setShowP2pMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems = [
    {
      name: "Home",
      href: "https://ethsltd.com/",
      icon: Home,
      isActive: false,
    },
    {
      name: "Trade",
      href: "https://ethsltd.com/",
      icon: LineChart,
      isActive: false,
    },
    {
      name: "P2P",
      isMenu: true,
      icon: Zap,
      isActive: pathname.startsWith("/p2p") || pathname.startsWith("/expert"),
    },
    {
      name: "Wallet",
      href: "/wallet?tab=currency",
      icon: CreditCard,
      isActive: pathname.startsWith("/wallet") && tab !== "asset",
    },
    {
      name: "Assets",
      href: "/wallet?tab=asset",
      icon: Wallet,
      isActive: (pathname.startsWith("/wallet") && tab === "asset") || pathname === "/account/profile",
    },
  ];

  return (
    <>
      {/* P2P Submenu Overlay */}
      {showP2pMenu && (
        <div 
          ref={menuRef}
          className="fixed bottom-[70px] left-1/2 -translate-x-1/2 w-[90%] max-w-[300px] bg-[#1E2026] border border-white/10 rounded-2xl shadow-2xl z-50 p-2 animate-in slide-in-from-bottom-4 fade-in"
        >
          <div className="grid grid-cols-2 gap-2">
            <Link 
              href="/p2p"
              onClick={() => setShowP2pMenu(false)}
              className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-white/5 transition-colors gap-2"
            >
              <ShoppingBag className="w-6 h-6 text-[#00C087]" />
              <span className="text-xs font-medium text-white text-center">P2P Marketplace</span>
            </Link>
            
            <Link 
              href="/p2p/orders"
              onClick={() => setShowP2pMenu(false)}
              className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-white/5 transition-colors gap-2"
            >
              <Shield className="w-6 h-6 text-[#00C087]" />
              <span className="text-xs font-medium text-white text-center">P2P Orders</span>
            </Link>
            
            <Link 
              href="/p2p/my-ads"
              onClick={() => setShowP2pMenu(false)}
              className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-white/5 transition-colors gap-2"
            >
              <BadgeDollarSign className="w-6 h-6 text-[#00C087]" />
              <span className="text-xs font-medium text-white text-center">My Ads</span>
            </Link>

            <Link 
              href="/p2p/experts"
              onClick={() => setShowP2pMenu(false)}
              className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-white/5 transition-colors gap-2"
            >
              <HeadphonesIcon className="w-6 h-6 text-[#00C087]" />
              <span className="text-xs font-medium text-white text-center">Expert Services</span>
            </Link>
          </div>
        </div>
      )}

      {/* Main Bottom Nav */}
      <div className="fixed bottom-0 left-0 z-40 w-full bg-[#181A20] border-t border-white/5 pb-[env(safe-area-inset-bottom)]">
        <div className="grid h-16 w-full grid-cols-5 max-w-[1280px] mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const activeClass = item.isActive ? "text-[#00C087]" : "text-muted-foreground hover:text-[#00C087]/70";
            
            if (item.isMenu) {
              return (
                <button
                  key={item.name}
                  ref={buttonRef}
                  onClick={() => setShowP2pMenu(!showP2pMenu)}
                  className={`flex flex-col items-center justify-center gap-1 group transition-colors ${showP2pMenu || item.isActive ? "text-[#00C087]" : "text-muted-foreground hover:text-[#00C087]/70"}`}
                >
                  <Icon
                    className={`w-[22px] h-[22px] ${showP2pMenu || item.isActive ? "fill-[#00C087]/10" : ""}`}
                    strokeWidth={showP2pMenu || item.isActive ? 2.5 : 2}
                  />
                  <span className="text-[10px] font-medium leading-none">{item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href!}
                className={`flex flex-col items-center justify-center gap-1 group transition-colors ${activeClass}`}
              >
                <Icon
                  className={`w-[22px] h-[22px] ${item.isActive ? "fill-[#00C087]/10" : ""}`}
                  strokeWidth={item.isActive ? 2.5 : 2}
                />
                <span className="text-[10px] font-medium leading-none">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
