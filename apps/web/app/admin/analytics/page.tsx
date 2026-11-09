"use client";

import { Server, TrendingUp, Users, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { PageBody, PageHeader } from "@/app/dashboard/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

const StatCard = ({
  title,
  value,
  icon: Icon,
  description,
  isLoading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  isLoading?: boolean;
}) => (
  <div className="border-border/50 bg-card/30 rounded-2xl border p-4 backdrop-blur-sm md:p-5">
    <div className="mb-3 flex items-center justify-between">
      <p className="text-muted-foreground text-sm font-medium">{title}</p>
      <div className="border-border/50 bg-card/50 rounded-lg border p-1.5">
        {isLoading ? (
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        ) : (
          <Icon className="text-muted-foreground size-4" />
        )}
      </div>
    </div>
    <p className="text-2xl font-bold tracking-tight">
      {isLoading ? (
        <span className="bg-muted inline-block h-8 w-20 animate-pulse rounded" />
      ) : (
        value
      )}
    </p>
    {description && !isLoading && (
      <p className="text-muted-foreground mt-1 text-xs">{description}</p>
    )}
  </div>
);

const ChartSkeleton = () => (
  <div className="bg-muted h-80 w-full animate-pulse rounded-lg" />
);

interface AnalyticsData {
  activeServers: number;
  totalServers: number;
  serverUptime: number;
  newUsersThisMonth: number;
  serversByGame: { game: string; count: number }[];
  serverStatus: { status: string; count: number }[];
  signupsTrend: { date: string; signups: number }[];
}

const tooltipStyle = {
  backgroundColor: "rgba(0,0,0,0.8)",
  border: "none",
  borderRadius: "0.5rem",
};

const KPICards = ({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: AnalyticsData | null;
}) => (
  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
    <StatCard
      title="Active Servers"
      value={
        isLoading
          ? "..."
          : `${data?.activeServers || 0} / ${data?.totalServers || 0}`
      }
      icon={Server}
      description="active / total"
      isLoading={isLoading}
    />
    <StatCard
      title="Server Uptime"
      value={isLoading ? "..." : `${(data?.serverUptime || 0).toFixed(2)}%`}
      icon={TrendingUp}
      isLoading={isLoading}
    />
    <StatCard
      title="New Users This Month"
      value={isLoading ? "..." : data?.newUsersThisMonth || 0}
      icon={Users}
      isLoading={isLoading}
    />
  </div>
);

const ChartsGrid = ({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: AnalyticsData | null;
}) => (
  <div className="grid gap-6 lg:grid-cols-2">
    <Card>
      <CardHeader>
        <CardTitle>Server Count by Game</CardTitle>
        <CardDescription>Active servers per game type</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.serversByGame || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="game" style={{ fontSize: "0.875rem" }} />
                <YAxis style={{ fontSize: "0.875rem" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar
                  dataKey="count"
                  fill="#3b82f6"
                  name="Servers"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Server Status Breakdown</CardTitle>
        <CardDescription>Distribution of server states</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.serverStatus || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: unknown) => {
                    const itemData = entry as Record<string, unknown>;
                    return String(itemData.status ?? "");
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {(data?.serverStatus || []).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>New Signups Trend</CardTitle>
        <CardDescription>User registrations over time</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.signupsTrend || []}>
                <defs>
                  <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  style={{ fontSize: "0.875rem" }}
                  tickFormatter={(date: string) => {
                    const d = new Date(date);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis style={{ fontSize: "0.875rem" }} />
                <Tooltip
                  labelFormatter={(date: unknown) =>
                    new Date(String(date)).toLocaleDateString()
                  }
                  contentStyle={tooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="signups"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorSignups)"
                  name="Signups"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
);

const AnalyticsDashboard = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateRange = (searchParams.get("range") || "30") as string;
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/analytics?range=${dateRange}`);
        const analyticsData = await response.json();
        setData(analyticsData);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [dateRange]);

  const handleDateRangeChange = (value: string) => {
    router.push(`/admin/analytics?range=${value}`);
  };

  return (
    <>
      <PageHeader title="Analytics" />
      <PageBody>
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <label htmlFor="date-range-select" className="text-sm font-medium">
              Date Range:
            </label>
            <Select value={dateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-40" id="date-range-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <KPICards isLoading={isLoading} data={data} />
          <ChartsGrid isLoading={isLoading} data={data} />
        </div>
      </PageBody>
    </>
  );
};

export default AnalyticsDashboard;
