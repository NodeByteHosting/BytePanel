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
import { games } from "@/games";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

import { PageBody, PageHeader } from "./components/page-header";
import { ServerGrid } from "./components/server-grid";

const DashboardPage = async () => {
  const user = await requireUser();
  const servers = await prisma.server.findMany({
    orderBy: { createdAt: "desc" },
    where: { deletedAt: null, userId: user.id },
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
                {games.slice(0, 6).map((game, i) => (
                  <Image
                    key={game.id}
                    src={game.image}
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
