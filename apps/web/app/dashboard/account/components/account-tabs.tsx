"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { href: "/dashboard/account", label: "Profile", value: "profile" },
  { href: "/dashboard/account/password", label: "Password", value: "password" },
  { href: "/dashboard/account/security", label: "Security", value: "security" },
  { href: "/dashboard/account/billing", label: "Billing", value: "billing" },
] as const;

const SECURITY_TABS = new Set<string>(["password", "security"]);

export const AccountTabs = ({ showSecurity }: { showSecurity: boolean }) => {
  const tabs = TABS.filter(
    (tab) => showSecurity || !SECURITY_TABS.has(tab.value)
  );
  const segment = useSelectedLayoutSegment();
  const activeTab =
    segment && tabs.some((tab) => tab.value === segment) ? segment : "profile";

  return (
    <Tabs className="[&_[data-slot=tabs-trigger]]:flex-none" value={activeTab}>
      <TabsList variant="line">
        {tabs.map((tab) => (
          <TabsTrigger asChild key={tab.value} value={tab.value}>
            <Link href={tab.href}>{tab.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};
