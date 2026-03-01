"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
    href: string;
    icon: string;
    label: string;
}

const navItems: NavItem[] = [
    { href: "/", icon: "🏠", label: "Home" },
    { href: "/train", icon: "🏋️", label: "Entrenar" },
    { href: "/progress", icon: "📊", label: "Progreso" },
    { href: "/ai", icon: "🤖", label: "IA" },
    { href: "/profile", icon: "👤", label: "Perfil" },
];

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-bottom">
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
                {navItems.map((item) => {
                    const isActive =
                        item.href === "/"
                            ? pathname === "/"
                            : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span className="text-xl leading-none">{item.icon}</span>
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
