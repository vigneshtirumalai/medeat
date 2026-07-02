import React from "react";
import { Link, useLocation } from "wouter";
import { Home, Pill, Utensils, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "./NotificationCenter";

export function GlobalHeader() {
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/50">
      <div className="flex h-11 items-center justify-between px-4 max-w-md mx-auto">
        <span className="text-sm font-semibold tracking-tight text-foreground/80">MedEat</span>
        <NotificationCenter />
      </div>
    </header>
  );
}

export function BottomNav() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Home", icon: Home },
    { href: "/medicines", label: "Meds", icon: Pill },
    { href: "/diet", label: "Diet", icon: Utensils },
    { href: "/profile", label: "Me", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe">
      <div className="flex h-16 items-center justify-around px-2 max-w-md mx-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
          
          return (
            <Link key={link.href} href={link.href} className={cn(
              "flex flex-col items-center justify-center w-full h-full space-y-1 text-muted-foreground transition-colors",
              isActive && "text-primary"
            )}>
              <div className={cn(
                "p-1.5 rounded-full transition-all duration-200",
                isActive && "bg-primary/10"
              )}>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col max-w-md mx-auto bg-background pb-16">
      <GlobalHeader />
      {children}
      <BottomNav />
    </div>
  );
}
