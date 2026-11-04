"use client";

import {
  DollarSign,
  HardDrive,
  LayoutDashboard,
  Lock,
  Mail,
  Monitor,
  ScrollText,
  Server,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  superAdminOnly?: boolean;
  matchExact?: boolean;
}

const NAV: NavItem[] = [
  {
    href: "/admin",
    icon: LayoutDashboard,
    label: "Overview",
    matchExact: true,
  },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/servers", icon: Server, label: "Servers" },
  {
    href: "/admin/subscriptions",
    icon: DollarSign,
    label: "Subscriptions",
    superAdminOnly: true,
  },
  { href: "/admin/audit", icon: ScrollText, label: "Audit Log" },
  { href: "/admin/email", icon: Mail, label: "Email" },
  {
    href: "/admin/sessions",
    icon: Monitor,
    label: "Sessions",
    superAdminOnly: true,
  },
  {
    href: "/admin/snapshot",
    icon: HardDrive,
    label: "Snapshot Baking",
    superAdminOnly: true,
  },
];

export const AdminNav = ({ superAdmin }: { superAdmin: boolean }) => {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 flex-row flex-wrap gap-1 lg:w-48 lg:flex-col">
      {NAV.map(({ href, icon: Icon, label, superAdminOnly, matchExact }) => {
        if (superAdminOnly && !superAdmin) {
          return null;
        }
        const isActive = matchExact
          ? pathname === href
          : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {superAdminOnly && (
              <Lock className="text-muted-foreground/50 size-3 shrink-0" />
            )}
          </Link>
        );
      })}
    </nav>
  );
};
