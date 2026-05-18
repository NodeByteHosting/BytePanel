export const ADMIN_NAV_ITEMS = [
  {
    href: "/admin",
    icon: "LayoutDashboard",
    label: "Overview",
    matchExact: true,
  },
  { href: "/admin/users", icon: "Users", label: "Users" },
  { href: "/admin/servers", icon: "Server", label: "Servers" },
  {
    href: "/admin/subscriptions",
    icon: "DollarSign",
    label: "Subscriptions",
    superAdminOnly: true,
  },
  {
    href: "/admin/audit",
    icon: "ScrollText",
    label: "Audit Log",
  },
  {
    href: "/admin/email",
    icon: "Mail",
    label: "Email",
  },
  {
    href: "/admin/sessions",
    icon: "Monitor",
    label: "Sessions",
    superAdminOnly: true,
  },
  {
    href: "/admin/snapshot",
    icon: "HardDrive",
    label: "Baking",
    superAdminOnly: true,
  },
] as const;

export type AdminNavItem = (typeof ADMIN_NAV_ITEMS)[number];
