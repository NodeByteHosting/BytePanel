import { PlusIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

import { PageBody, PageHeader } from "./components/page-header";
import { ServerGrid } from "./components/server-grid";

const DashboardPage = async () => {
  const user = await requireUser();
  const rows = await prisma.server.findMany({
    include: {
      allocation: { select: { ip: true, ipAlias: true, port: true } },
      egg: { select: { image: true, name: true } },
      node: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    where: {
      OR: [{ userId: user.id }, { members: { some: { userId: user.id } } }],
      deletedAt: null,
    },
  });
  const servers = rows.map((s) => ({
    address: s.allocation
      ? `${s.allocation.ipAlias ?? s.allocation.ip}:${s.allocation.port}`
      : null,
    cpu: s.cpu,
    deployed: s.nodeId !== null,
    game: s.egg ? { image: s.egg.image, name: s.egg.name } : null,
    id: s.id,
    memory: s.memory,
    name: s.name,
    nodeName: s.node?.name ?? null,
    status: s.status,
  }));
  const showcase = await prisma.egg.findMany({
    select: { id: true, image: true, name: true },
    take: 6,
    where: { enabled: true, image: { not: null } },
  });

  const newServerAction = (
    <Button asChild size="sm">
      <Link href="/dashboard/new">
        <PlusIcon />
        New server
      </Link>
    </Button>
  );

  if (servers.length === 0) {
    return (
      <>
        <PageHeader actions={newServerAction} title="Servers" />
        <PageBody wide>
          <Empty>
            <EmptyHeader>
              <EmptyMedia className="flex -space-x-2">
                {showcase.map((game, i) => (
                  <Image
                    key={game.id}
                    src={game.image ?? ""}
                    alt={game.name}
                    width={40}
                    height={40}
                    className={cn(
                      "size-10 rounded-md object-cover ring-2 ring-white transition-transform hover:-translate-y-1",
                      i % 2 === 0 ? "-rotate-3" : "rotate-3"
                    )}
                  />
                ))}
              </EmptyMedia>
              <EmptyTitle>No servers yet</EmptyTitle>
              <EmptyDescription>
                Spin up your first game server in under a minute.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild size="lg">
                <Link href="/dashboard/new">
                  <PlusIcon />
                  Create your first server
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader actions={newServerAction} title="Servers" />
      <PageBody wide>
        <ServerGrid servers={servers} />
      </PageBody>
    </>
  );
};

export default DashboardPage;
