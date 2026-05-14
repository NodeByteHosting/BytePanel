"use client";

import { Globe, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const linkClass =
  "relative whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground after:pointer-events-none after:absolute after:-bottom-[5px] after:inset-x-3 after:h-px after:bg-foreground after:opacity-0 aria-[current=page]:text-foreground aria-[current=page]:after:opacity-100";

const iconLinkClass =
  "flex items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground";

export const FloatingNav = ({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) => {
  const pathname = usePathname();
  const isActive = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <nav
      aria-label="Primary"
      className="-translate-x-1/2 fixed bottom-6 left-1/2 z-40 flex items-center gap-1 rounded-full border border-foreground/10 bg-background/80 p-1 pl-3 shadow-foreground/5 shadow-lg backdrop-blur"
    >
      <Link
        href="/"
        aria-current={isActive("/")}
        className="flex items-center gap-2 pl-1 pr-2 text-sm font-semibold text-foreground"
      >
        <Logo className="h-5 w-auto text-foreground" />
      </Link>
      {/* Text label on desktop, icon on mobile */}
      <Link
        href="https://nodebyte.host"
        target="_blank"
        rel="noreferrer"
        aria-label="Main site"
        className={cn(linkClass, "hidden sm:inline-block")}
      >
        Main site
      </Link>
      <Link
        href="https://nodebyte.host"
        target="_blank"
        rel="noreferrer"
        aria-label="Main site"
        className={cn(iconLinkClass, "sm:hidden")}
      >
        <Globe className="size-4" />
      </Link>
      <Link
        href="https://discord.gg/nodebyte"
        target="_blank"
        rel="noreferrer"
        aria-label="Discord"
        className={cn(linkClass, "hidden sm:inline-block")}
      >
        Discord
      </Link>
      <Link
        href="https://discord.gg/nodebyte"
        target="_blank"
        rel="noreferrer"
        aria-label="Discord"
        className={cn(iconLinkClass, "sm:hidden")}
      >
        <MessageCircle className="size-4" />
      </Link>
      {isAuthenticated ? (
        <Button asChild size="sm" className="ml-2 rounded-full">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      ) : (
        <>
          <Link
            href="/sign-in"
            aria-current={isActive("/sign-in")}
            className={cn(linkClass, "ml-2 hidden sm:inline-block")}
          >
            Sign in
          </Link>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/sign-in">Get started</Link>
          </Button>
        </>
      )}
    </nav>
  );
};
