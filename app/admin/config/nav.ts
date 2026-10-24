export const ADMIN_NAV_ITEMS = [
  {
    href: "/admin",
    icon: "LayoutDashboard",
    label: "Overview",
    matchExact: true,
  },
  { href: "/admin/users", icon: "Users", label: "Users" },
  { href: "/admin/servers", icon: "Server", label: "Servers" },
  { href: "/admin/nodes", icon: "HardDrive", label: "Nodes" },
  { href: "/admin/locations", icon: "MapPin", label: "Locations" },
  { href: "/admin/nests", icon: "Egg", label: "Nests & Eggs" },
  { href: "/admin/plans", icon: "Package", label: "Plans" },
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
] as const;

export type AdminNavItem = (typeof ADMIN_NAV_ITEMS)[number];
