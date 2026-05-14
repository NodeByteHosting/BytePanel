import Link from "next/link";

import { Button } from "@/components/ui/button";
import { games } from "@/games";
import { SNAPSHOT_ENVIRONMENT } from "@/lib/env";
import {
  getProviderForUserWithImage,
  MissingProviderCredentialsError,
} from "@/lib/providers";
import type { Catalog } from "@/lib/providers/types";
import { requireUser } from "@/lib/session";

import { PageBody, PageHeader } from "../components/page-header";
import { NewServerForm } from "./components/form";
import type { GameOption } from "./components/form";

const NewServerPage = async () => {
  const user = await requireUser();
  let catalog: Catalog;
  try {
    const { provider, imageId } = await getProviderForUserWithImage(
      user.id,
      SNAPSHOT_ENVIRONMENT
    );
    catalog = await provider.getCatalog(imageId);
  } catch (error) {
    if (error instanceof MissingProviderCredentialsError) {
      return (
        <>
          <PageHeader title="New server" />
          <PageBody>
            <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 p-8 text-center backdrop-blur-sm">
              <p className="font-semibold text-lg">
                Provisioning is not ready yet
              </p>
              <p className="mt-2 text-muted-foreground text-sm">
                No base snapshot image is configured for environment
                <span className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {SNAPSHOT_ENVIRONMENT}
                </span>
                . Set{" "}
                <span className="font-mono">HETZNER_SNAPSHOT_IMAGE_ID</span> or
                create a matching system snapshot before deploying servers.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </PageBody>
        </>
      );
    }
    throw error;
  }

  const gameOptions: GameOption[] = games
    .filter((g) => g.enabled)
    .map((g) => ({
      description: g.description,
      dockerImage: g.dockerImage,
      id: g.id,
      image: g.image,
      name: g.name,
      requirements: {
        cpu: g.requirements.cpu,
        disk: g.requirements.disk,
        memory: g.requirements.memory,
      },
      settings: g.settings,
    }));

  return (
    <NewServerForm
      games={gameOptions}
      serverTypes={catalog.serverTypes}
      currency={catalog.currency}
    />
  );
};

export default NewServerPage;
