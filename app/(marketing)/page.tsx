import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Cpu,
  HelpCircle,
  Monitor,
  Server,
  Shield,
  Sparkles,
  Terminal,
  Users,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { games } from "@/games";
import { prisma } from "@/lib/db";
import { SNAPSHOT_ENVIRONMENT } from "@/lib/env";
import {
  getProviderForUserWithImage,
  MissingProviderCredentialsError,
} from "@/lib/providers";
import type { CatalogServerType } from "@/lib/providers/types";
import { getSession } from "@/lib/session";

import HeroGraphic from "./components/hero-graphic";
import { PricingSection } from "./components/pricing-section";

const FAQS = [
  {
    answer:
      "NodeByte Panel is the control panel for NodeByte Hosting customers. It lets you spin up, manage, and monitor your game servers without touching a command line.",
    question: "What is NodeByte Panel?",
  },
  {
    answer:
      "Your server is usually ready within 60–90 seconds of placing an order. We pre-build golden images so the majority of setup is already done before you click Deploy.",
    question: "How long does it take to spin up a server?",
  },
  {
    answer:
      "Yes. The Team tab on any server lets you invite team members by email and assign them a role Viewer, Member, or Admin so you can control exactly what they can do.",
    question: "Can I give my friends access to my server?",
  },
  {
    answer:
      "All billing is handled through Stripe. You can view invoices, update your payment method, and cancel subscriptions from the Billing page inside your account settings.",
    question: "How does billing work?",
  },
  {
    answer:
      "You can restart or reinstall your server at any time from the panel. Each server also supports manual backups which you can restore in one click.",
    question: "What happens if my server crashes?",
  },
  {
    answer:
      "NodeByte partners with multiple leading cloud infrastructure providers to power our services, giving you enterprise-grade NVMe SSD storage, DDoS protection, and redundant networking across multiple regions.",
    question: "What infrastructure powers NodeByte servers?",
  },
];

const BASE_STATS = [
  { icon: Shield, label: "Uptime SLA", value: "99.6%" },
  { icon: Zap, label: "Deploy time", value: "~60s" },
  { icon: Server, label: "Server regions", value: "6" },
];

const FEATURES = [
  {
    description:
      "From order to online in under a minute. Pre-built images mean your server is ready before you can make a cup of tea.",
    highlights: [
      "Automated provisioning",
      "Pre-configured defaults",
      "No technical knowledge needed",
    ],
    icon: Zap,
    title: "Deploy in under 60 seconds",
  },
  {
    description:
      "Invite friends, assign roles, control access. Viewer, Member, or Admin your server, your rules.",
    highlights: [
      "Per-server team access",
      "Role-based permissions",
      "Invite by email",
    ],
    icon: Users,
    title: "Built for teams",
  },
  {
    description:
      "Console, file manager, metrics, backups, and game settings no external tools needed.",
    highlights: [
      "Web-based file manager",
      "Live server console",
      "One-click backups",
    ],
    icon: Monitor,
    title: "Everything in one dashboard",
  },
  {
    description:
      "Enterprise DDoS mitigation included on every plan. 99.6% uptime SLA, NVMe SSD on every node.",
    highlights: [
      "Network-level DDoS filtering",
      "99.6% uptime SLA",
      "NVMe SSD storage",
    ],
    icon: Shield,
    title: "Protected by default",
  },
];

const STEPS = [
  {
    body: "Pick a supported game, choose a server size, and customise your settings all from one form.",
    num: "01",
    title: "Choose your game & plan",
  },
  {
    body: "We provision your server instantly. No waiting, no command lines. Ready to join in under 60 seconds.",
    num: "02",
    title: "Deploy in seconds",
  },
  {
    body: "Invite your team, tweak settings, manage files, and monitor performance from any device.",
    num: "03",
    title: "Play & manage",
  },
];

const HomePage = async () => {
  const session = await getSession();
  const isAuthenticated = Boolean(session?.user);

  const serverCount = await prisma.server
    .count({ where: { deletedAt: null } })
    .catch(() => 0);

  // Fetch live pricing catalog — silently skip if not yet configured.
  let serverTypes: CatalogServerType[] = [];
  let currency = "GBP";
  try {
    const { provider, imageId } = await getProviderForUserWithImage(
      "public",
      SNAPSHOT_ENVIRONMENT
    );
    const catalog = await provider.getCatalog(imageId);
    ({ serverTypes } = catalog);
    ({ currency } = catalog);
  } catch (error) {
    if (!(error instanceof MissingProviderCredentialsError)) {
      console.error("[home] catalog fetch failed", error);
    }
  }

  const stats = [
    ...BASE_STATS,
    ...(serverCount > 0
      ? [
          {
            icon: Sparkles,
            label: "Active servers",
            value: serverCount.toLocaleString(),
          },
        ]
      : [
          {
            icon: Sparkles,
            label: "Games supported",
            value: String(games.length),
          },
        ]),
  ];

  // First 3 games get large artwork cards; the rest appear as compact chips.
  const featuredGames = games.slice(0, 3);
  const remainingGames = games.slice(3);

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pb-20 pt-32">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-background to-background" />

        {/* Animated orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute left-1/4 top-1/4 h-125 w-125 animate-pulse rounded-full bg-primary/10 blur-[120px]" />
          <div
            className="absolute bottom-1/4 right-1/4 h-100 w-100 animate-pulse rounded-full bg-accent/10 blur-[100px]"
            style={{ animationDelay: "1s" }}
          />
          <div className="absolute left-1/2 top-1/2 h-150 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[150px]" />
        </div>

        {/* Subtle grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(ellipse_60%_60%_at_50%_50%,black_40%,transparent_100%)]" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left: text + CTA */}
            <div className="flex flex-col gap-8 text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 self-center rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm backdrop-blur-sm lg:self-start">
                <Sparkles className="size-4 text-primary" />
                <span className="text-muted-foreground">
                  Welcome to our{" "}
                  <strong className="font-semibold text-primary">
                    GAME SERVER MANAGER
                  </strong>
                </span>
              </div>

              {/* Heading */}
              <div className="flex flex-col gap-4">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-5xl xl:text-6xl">
                  <span className="bg-linear-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    NodeByte Game
                  </span>
                  <br />
                  <span className="bg-linear-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                    Server Manager.
                  </span>
                </h1>
                <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
                  Deploy, monitor, and manage your NodeByte game servers. Invite
                  team members, track performance, and keep your worlds running
                  all from one place.
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
                {isAuthenticated ? (
                  <Button
                    asChild
                    size="lg"
                    className="h-12 w-full rounded-full px-8 text-base sm:w-auto"
                  >
                    <Link href="/dashboard">
                      Go to dashboard <ArrowRight className="ml-1 size-4" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button
                      asChild
                      size="lg"
                      className="h-12 w-full rounded-full px-8 text-base sm:w-auto"
                    >
                      <Link href="/sign-in">
                        Sign in <ArrowRight className="ml-1 size-4" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="h-12 w-full rounded-full border-border/50 bg-card/30 px-8 text-base backdrop-blur-sm hover:border-primary/30 hover:bg-card/50 sm:w-auto"
                    >
                      <Link
                        href="https://nodebyte.host"
                        target="_blank"
                        rel="noreferrer"
                      >
                        nodebyte.host
                      </Link>
                    </Button>
                  </>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {stats.map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="flex flex-col gap-1 rounded-2xl border border-border/50 bg-card/30 p-4 backdrop-blur-sm"
                  >
                    <Icon className="mb-1 size-4 text-primary" />
                    <span className="text-2xl font-bold tracking-tight">
                      {value}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: globe graphic */}
            <div className="hidden lg:flex lg:items-center lg:justify-center">
              <HeroGraphic />
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative py-24">
        <div className="absolute inset-0 bg-linear-to-b from-background via-primary/5 to-background" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="mb-12 flex flex-col gap-3 text-center">
            <div className="inline-flex items-center gap-2 self-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs backdrop-blur-sm">
              <Sparkles className="size-3 text-primary" />
              <span className="font-medium text-primary">
                Built for players
              </span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to run game servers
            </h2>
            <p className="mx-auto max-w-lg text-muted-foreground">
              No DevOps experience required. NodeByte Panel handles the
              infrastructure so you can focus on playing.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, description, highlights }) => (
              <div
                key={title}
                className="group flex flex-col gap-4 rounded-2xl border border-border/50 bg-card/30 p-5 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-card/50"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary/20">
                  <Icon className="size-5" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-semibold leading-snug">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
                <ul className="flex flex-col gap-1.5 pt-1">
                  {highlights.map((h) => (
                    <li
                      key={h}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <CheckCircle2 className="size-3 shrink-0 text-primary" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dedicated infrastructure ── */}
      <section className="relative py-24">
        <div className="absolute inset-0 bg-linear-to-b from-background via-accent/3 to-background" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="mb-12 flex flex-col gap-3 text-center">
            <div className="inline-flex items-center gap-2 self-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs backdrop-blur-sm">
              <Cpu className="size-3 text-primary" />
              <span className="font-medium text-primary">Infrastructure</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Your server.{" "}
              <span className="bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">
                Not shared.
              </span>
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Most game hosting panels cram hundreds of servers onto a single
              machine. Every server on NodeByte runs on its own dedicated VM
              with its own IP address, CPU, and RAM. What you pay for is yours,
              period.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* NodeByte: dedicated */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card/40 p-8 backdrop-blur-sm">
              <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent" />
              <div className="relative flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Shield className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">NodeByte</div>
                    <div className="text-xs text-muted-foreground">
                      Dedicated VM per server
                    </div>
                  </div>
                  <div className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    How we do it
                  </div>
                </div>
                <ul className="flex flex-col gap-3">
                  {[
                    "Dedicated VM no neighbours sharing your CPU",
                    "Your own public IPv4 address, every time",
                    "Isolated RAM and disk always what you paid for",
                    "Full network isolation no cross-tenant traffic",
                    "Consistent performance regardless of other users",
                  ].map((fact) => (
                    <li key={fact} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Others: shared */}
            <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/20 p-8 backdrop-blur-sm">
              <div className="relative flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
                    <Server className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-muted-foreground">
                      Most other hosts
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Shared container model
                    </div>
                  </div>
                </div>
                <ul className="flex flex-col gap-3">
                  {[
                    "Hundreds of servers share a single physical machine",
                    "Shared IP or dynamic port not a real address",
                    "Over-allocated resources other tenants affect you",
                    "Noisy neighbours cause unpredictable lag spikes",
                    "Performance degrades when the node is busy",
                  ].map((fact) => (
                    <li
                      key={fact}
                      className="flex items-start gap-2.5 text-sm text-muted-foreground"
                    >
                      <X className="mt-0.5 size-4 shrink-0 text-destructive/60" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Games showcase ── */}
      <section className="relative py-24">
        <div className="absolute inset-0 bg-linear-to-b from-background via-accent/3 to-background" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="mb-12 flex flex-col gap-3 text-center">
            <div className="inline-flex items-center gap-2 self-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs backdrop-blur-sm">
              <Server className="size-3 text-primary" />
              <span className="font-medium text-primary">Supported games</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {games.length} games, ready to deploy
            </h2>
            <p className="mx-auto max-w-lg text-muted-foreground">
              From Minecraft to Rust spin up your game server in under a minute.
            </p>
          </div>

          {/* Featured game cards — large artwork */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredGames.map((game) => (
              <div
                key={game.id}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
              >
                <div className="relative aspect-16/7 w-full overflow-hidden">
                  <Image
                    src={game.image}
                    alt={game.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-card/90 via-card/20 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-base font-semibold">{game.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Game server
                    </span>
                  </div>
                  <div className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    Ready to deploy
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Remaining games — compact chips */}
          {remainingGames.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2.5">
              {remainingGames.map((game) => (
                <div
                  key={game.id}
                  className="flex items-center gap-2 rounded-full border border-border/50 bg-card/30 px-3 py-1.5 backdrop-blur-sm transition-colors hover:border-primary/30 hover:bg-card/50"
                >
                  <Image
                    src={game.image}
                    alt={game.name}
                    width={20}
                    height={20}
                    className="size-5 rounded-md object-cover"
                  />
                  <span className="text-sm font-medium">{game.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative py-24">
        <div className="absolute inset-0 bg-linear-to-b from-background via-primary/5 to-background" />
        <div className="relative z-10 mx-auto max-w-4xl px-6">
          <div className="mb-12 flex flex-col gap-3 text-center">
            <div className="inline-flex items-center gap-2 self-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs backdrop-blur-sm">
              <Terminal className="size-3 text-primary" />
              <span className="font-medium text-primary">How it works</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Up and running in three steps
            </h2>
            <p className="mx-auto max-w-lg text-muted-foreground">
              No VMs, no SSH, no configuration files. Just pick, deploy, and
              play.
            </p>
          </div>

          <div className="relative grid gap-6 sm:grid-cols-3">
            {/* Connector line visible on desktop */}
            <div className="absolute left-[16.666%] right-[16.666%] top-8 hidden h-px bg-linear-to-r from-transparent via-border to-transparent sm:block" />
            {STEPS.map(({ num, title, body }) => (
              <div
                key={num}
                className="relative flex flex-col items-center gap-4 text-center"
              >
                <div className="relative flex size-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-2xl font-black text-primary shadow-lg shadow-primary/10">
                  {num}
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full px-8 text-base"
            >
              <Link href={isAuthenticated ? "/dashboard/new" : "/sign-in"}>
                {isAuthenticated ? "Deploy a server" : "Start now"}
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      {serverTypes.length > 0 && (
        <section className="relative py-24">
          <div className="absolute inset-0 bg-linear-to-b from-background via-primary/5 to-background" />
          <div className="relative z-10 mx-auto max-w-6xl px-6">
            <div className="mb-12 flex flex-col gap-3 text-center">
              <div className="inline-flex items-center gap-2 self-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs backdrop-blur-sm">
                <CreditCard className="size-3 text-primary" />
                <span className="font-medium text-primary">Pricing</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Simple, transparent pricing
              </h2>
              <p className="mx-auto max-w-lg text-muted-foreground">
                Pick any server size. Pay monthly, cancel anytime. No contracts,
                no hidden fees. All prices in GBP.
              </p>
            </div>
            <PricingSection
              serverTypes={serverTypes}
              currency={currency}
              isAuthenticated={isAuthenticated}
            />
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="relative py-24">
        <div className="absolute inset-0 bg-linear-to-b from-background via-primary/5 to-background" />
        <div className="relative z-10 mx-auto max-w-4xl px-6">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card/40 p-10 text-center backdrop-blur-sm md:p-16">
            <div className="absolute inset-0 -z-10 bg-linear-to-br from-primary/10 via-transparent to-accent/10" />
            <div className="absolute -left-20 -top-20 h-64 w-64 animate-pulse rounded-full bg-primary/15 blur-[80px]" />
            <div className="absolute -bottom-20 -right-20 h-64 w-64 animate-pulse rounded-full bg-accent/15 blur-[80px]" />
            <div className="relative flex flex-col items-center gap-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm">
                <Sparkles className="size-4 text-primary" />
                <span className="font-medium text-primary">Ready to play?</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Your server is{" "}
                <span className="bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">
                  60 seconds away
                </span>
              </h2>
              <p className="max-w-xl text-muted-foreground">
                Join NodeByte Panel today. Deploy your first server whenever
                you&apos;re ready.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full px-8 text-base"
                >
                  <Link href={isAuthenticated ? "/dashboard/new" : "/sign-in"}>
                    {isAuthenticated ? "Deploy a server" : "Get started"}
                    <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
                {!isAuthenticated && (
                  <Button
                    asChild
                    variant="ghost"
                    size="lg"
                    className="h-12 rounded-full px-8 text-base text-muted-foreground hover:text-foreground"
                  >
                    <Link
                      href="https://nodebyte.host"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Browse hosting plans
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="relative py-24">
        <div className="absolute inset-0 bg-linear-to-b from-background via-accent/5 to-background" />
        <div className="relative z-10 mx-auto max-w-3xl px-6">
          <div className="mb-12 flex flex-col gap-3 text-center">
            <div className="inline-flex items-center gap-2 self-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs backdrop-blur-sm">
              <HelpCircle className="size-3 text-primary" />
              <span className="font-medium text-primary">FAQ</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently asked questions
            </h2>
            <p className="text-muted-foreground">
              Still have questions?{" "}
              <Link
                href="https://nodebyte.host/contact"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Contact support
              </Link>
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border-border/50 px-2 last:border-0"
                >
                  <AccordionTrigger className="py-5 text-left font-medium hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
