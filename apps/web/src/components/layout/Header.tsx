"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, User, ChevronDown, LogOut, LayoutDashboard, Shield, Settings, Bell, Info } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { useAuthStore } from "@/stores/auth-store"

import { apiClient } from "@ethsltd/api-client"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { NotificationBell } from "@/components/notifications/NotificationBell"

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false)
  const [announcementVisible, setAnnouncementVisible] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const { user, status, logout } = useAuthStore()

  const handleLogout = async () => {
    await apiClient.logout()
    logout()
    window.location.href = '/login'
    setDropdownOpen(false)
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full flex flex-col">
      {/* Announcement Bar */}
      {announcementVisible && (
        <div className="bg-primary text-white px-8 sm:px-12 py-2 text-xs sm:text-sm flex justify-center items-center relative text-center min-h-[40px]">
          <span className="truncate sm:whitespace-normal">ETHSLTD Markets are live — Explore the latest digital assets &rarr;</span>
          <button
            onClick={() => setAnnouncementVisible(false)}
            className="absolute right-2 sm:right-4 text-white/80 hover:text-white p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Navigation */}
      <div
        className={`w-full transition-all duration-300 ${(isScrolled || mobileMenuOpen)
            ? "bg-background/95 backdrop-blur-md border-b border-border shadow-sm"
            : "bg-transparent border-b border-transparent"
          }`}
      >
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 min-h-[4rem] py-2 flex items-center justify-between flex-wrap gap-y-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-display font-bold text-xl text-foreground tracking-tight flex items-center gap-2">
              <Logo className="h-8 sm:h-10 md:h-12 w-auto" />
            </Link>

            <nav className="hidden lg:flex items-center gap-6">
              <Link href="/markets" className={`text-sm font-medium transition-colors ${pathname === '/markets' ? 'text-brand-foreground font-semibold border-b-2 border-brand-foreground pb-1' : 'text-muted-foreground hover:text-foreground'}`}>Markets</Link>
              
              <Link href="/p2p" className={`text-sm font-medium transition-colors ${pathname?.startsWith('/p2p') ? 'text-brand-foreground font-semibold border-b-2 border-brand-foreground pb-1' : 'text-muted-foreground hover:text-foreground pb-1'}`}>P2P</Link>
              <Link href="/wallet" className={`text-sm font-medium transition-colors ${pathname?.startsWith('/wallet') ? 'text-brand-foreground font-semibold border-b-2 border-brand-foreground pb-1' : 'text-muted-foreground hover:text-foreground pb-1'}`}>Wallet</Link>
              <Link href="/markets" className={`text-sm font-medium transition-colors ${pathname === '/markets' ? 'text-brand-foreground font-semibold border-b-2 border-brand-foreground pb-1' : 'text-muted-foreground hover:text-foreground pb-1'}`}>Assets</Link>
              <Link href="/learn" className={`text-sm font-medium transition-colors ${pathname?.startsWith('/learn') ? 'text-brand-foreground font-semibold border-b-2 border-brand-foreground pb-1' : 'text-muted-foreground hover:text-foreground pb-1'}`}>Learn</Link>

              {/* More Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setMoreDropdownOpen(true)}
                onMouseLeave={() => setMoreDropdownOpen(false)}
              >
                <button
                  className={`text-sm font-medium transition-colors flex items-center gap-1 ${moreDropdownOpen ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'} pb-1`}
                  onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                >
                  More <ChevronDown className={`w-3 h-3 transition-transform ${moreDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {moreDropdownOpen && (
                  <div className="absolute top-full right-0 pt-2 w-48 z-50">
                    <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden py-1">
                      <Link href="/fees" className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">Fees</Link>
                      <Link href="/account/security" className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">Security</Link>
                      <Link href="/support" className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">Support</Link>
                      <Link href="/developer" className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">Developer API</Link>
                      <Link href="/about" className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">About ETHSLTD</Link>
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <ThemeToggle />



            {status === "authenticated" && user ? (
              <>
                <NotificationBell />
                <div className="relative ml-2">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 hover:bg-muted/50 py-1.5 px-3 rounded-full transition-colors border border-transparent hover:border-border"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary dark:bg-primary/10 text-primary dark:text-primary flex items-center justify-center overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{user.displayName || user.email.split('@')[0]}</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-xl py-2 z-50">
                      <div className="px-4 py-2 border-b border-border mb-2">
                        <p className="text-sm font-medium truncate">{user.email}</p>
                        <p className="text-xs text-muted-foreground">Account ID: {user.id.substring(0, 8)}...</p>
                      </div>
                      <Link href="/account" className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setDropdownOpen(false)}>
                        <LayoutDashboard className="w-4 h-4" /> Account
                      </Link>
                      {user.role === 'EXPERT' && (
                        <Link href="/expert/dashboard" className="flex items-center gap-3 px-4 py-2 text-sm text-brand-primary font-medium hover:bg-brand-primary/10" onClick={() => setDropdownOpen(false)}>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
                          Expert Dashboard
                        </Link>
                      )}
                      <Link href="/account/profile" className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setDropdownOpen(false)}>
                        <User className="w-4 h-4" /> Profile
                      </Link>
                      <Link href="/account/security" className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setDropdownOpen(false)}>
                        <Shield className="w-4 h-4" /> Security
                      </Link>
                      <Link href="/account/preferences" className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setDropdownOpen(false)}>
                        <Settings className="w-4 h-4" /> Preferences
                      </Link>
                      <div className="border-t border-border mt-2 pt-2">
                        <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-destructive/10">
                          <LogOut className="w-4 h-4" /> Log Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ml-2">Log In</Link>
                <Button variant="default" asChild><Link href="/register">Sign Up</Link></Button>
              </>
            )}
          </div>

          <div className="lg:hidden flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <button
              className="text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full h-[calc(100vh-4rem)] overflow-y-auto bg-background border-t border-border p-4 pb-50 shadow-xl">
          <nav className="flex flex-col gap-4">
            <Link href="/markets" className={`text-lg font-medium py-2 border-b border-border ${pathname === '/markets' ? 'text-brand-foreground font-semibold' : 'text-foreground'}`} onClick={() => setMobileMenuOpen(false)}>Markets</Link>
            
            <Link href="/p2p" className={`text-lg font-medium py-2 border-b border-border ${pathname?.startsWith('/p2p') ? 'text-brand-foreground font-semibold' : 'text-foreground'}`} onClick={() => setMobileMenuOpen(false)}>P2P</Link>
            <Link href="/wallet" className={`text-lg font-medium py-2 border-b border-border ${pathname?.startsWith('/wallet') ? 'text-brand-foreground font-semibold' : 'text-foreground'}`} onClick={() => setMobileMenuOpen(false)}>Wallet</Link>
            <Link href="/markets" className="text-lg font-medium text-foreground py-2 border-b border-border" onClick={() => setMobileMenuOpen(false)}>Assets</Link>
            <Link href="/learn" className="text-lg font-medium text-foreground py-2 border-b border-border" onClick={() => setMobileMenuOpen(false)}>Learn</Link>

            <div className="py-2 border-b border-border">
              <button
                onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
                className="w-full flex items-center justify-between text-lg font-medium text-foreground flex-wrap gap-y-4"
              >
                More
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${mobileMoreOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className={`overflow-hidden transition-all duration-300 ${mobileMoreOpen ? 'max-h-[400px] mt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="flex flex-col gap-4 pl-4 pb-2 border-l-2 border-border/50 ml-2">
                  <Link href="/fees" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Fees</Link>
                  <Link href="/account/security" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Security</Link>
                  <Link href="/support" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Support</Link>
                  <Link href="/developer" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Developer API</Link>
                  <Link href="/about" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>About ETHSLTD</Link>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-4">
              {status === "authenticated" && user ? (
                <div className="py-2">
                  <button
                    onClick={() => setMobileProfileOpen(!mobileProfileOpen)}
                    className="w-full flex items-center justify-between py-2 flex-wrap gap-y-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary dark:bg-primary/10 text-primary dark:text-primary flex items-center justify-center overflow-hidden">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5" />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-foreground">{user.displayName || user.email.split('@')[0]}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${mobileProfileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <div className={`overflow-hidden transition-all duration-300 ${mobileProfileOpen ? 'max-h-[400px] mt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="flex flex-col gap-4 pl-4 py-2 border-l-2 border-border/50 ml-2">
                      <Link href="/account" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Account</Link>
                      {user.role === 'EXPERT' && (
                        <Link href="/expert/dashboard" className="text-base text-brand-primary font-medium hover:text-brand-primary/80" onClick={() => setMobileMenuOpen(false)}>Expert Dashboard</Link>
                      )}
                      <Link href="/account/profile" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Profile</Link>
                      <Link href="/account/security" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Security</Link>
                      <Link href="/account/preferences" className="text-base text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Preferences</Link>
                      <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="text-base text-left text-destructive mt-2">Log Out</button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Button variant="outline" className="w-full justify-center" asChild><Link href="/login" onClick={() => setMobileMenuOpen(false)}>Log In</Link></Button>
                  <Button variant="default" className="w-full justify-center" asChild><Link href="/register" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link></Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}

    </header>
  )
}
