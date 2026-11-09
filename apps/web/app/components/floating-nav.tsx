"use client";

import { Globe, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBranding } from "@/providers/branding";

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
  const { websiteUrl, supportUrl } = useBranding();

  return (
    <nav
      aria-label="Primary"
      className="border-foreground/10 bg-background/80 shadow-foreground/5 fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border p-1 pl-3 shadow-lg backdrop-blur"
    >
      <Link
        href="/"
        aria-current={isActive("/")}
        className="text-foreground flex items-center gap-2 pr-2 pl-1 text-sm font-semibold"
      >
        <BrandLogo className="text-foreground h-5 w-auto" />
      </Link>
      {websiteUrl && (
        <>
          <Link
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Main site"
            className={cn(linkClass, "hidden sm:inline-block")}
          >
            Main site
          </Link>
          <Link
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Main site"
            className={cn(iconLinkClass, "sm:hidden")}
          >
            <Globe className="size-4" />
          </Link>
        </>
      )}
      {supportUrl && (
        <>
          <Link
            href={supportUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Support"
            className={cn(linkClass, "hidden sm:inline-block")}
          >
            Support
          </Link>
          <Link
            href={supportUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Support"
            className={cn(iconLinkClass, "sm:hidden")}
          >
            <MessageCircle className="size-4" />
          </Link>
        </>
      )}
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
