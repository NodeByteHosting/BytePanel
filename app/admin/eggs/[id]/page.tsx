import { notFound } from "next/navigation";

import { Panel, PanelCard } from "@/components/panel";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

import {
  PageBody,
  PageHeader,
} from "../../../dashboard/components/page-header";
import { ImportEggDialog } from "../../nests/nests-client";
import { DeleteEggButton, EggForm, VariablesEditor } from "./egg-client";

const strings = (value: unknown) =>
  Array.isArray(value) ? value.map(String) : [];

const AdminEggPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  await requireAdmin();
  const { id } = await params;
  const egg = await prisma.egg.findUnique({
    include: {
      _count: { select: { servers: true } },
      nest: true,
      variables: { orderBy: { sort: "asc" } },
    },
    where: { id },
  });
  if (!egg) {
    notFound();
  }

  return (
    <>
      <PageHeader
        actions={
          <div className="flex gap-2">
            {!egg.slug && (
              <ImportEggDialog
                eggId={egg.id}
                nests={[{ id: egg.nestId, name: egg.nest.name }]}
              />
            )}
            <DeleteEggButton disabled={egg._count.servers > 0} id={egg.id} />
          </div>
        }
        title={`${egg.nest.name} / ${egg.name}`}
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          {egg.slug && (
            <Panel>
              <PanelCard className="text-muted-foreground text-sm">
                Built-in egg <code>{egg.slug}</code>. Edits here are overwritten
                the next time built-in games are synced; change the definition
                in the GSG repo instead.
              </PanelCard>
            </Panel>
          )}
          <Panel title="Configuration">
            <PanelCard>
              <EggForm
                eggId={egg.id}
                initial={{
                  configStop: egg.configStop,
                  containerPorts: strings(egg.containerPorts).map(Number),
                  containerUser:
                    egg.containerUser === "image" ? "image" : "daemon",
                  description: egg.description,
                  dockerImages: (egg.dockerImages ?? {}) as Record<
                    string,
                    string
                  >,
                  done: strings(egg.configStartupDone),
                  enabled: egg.enabled,
                  image: egg.image,
                  invocationMode:
                    egg.invocationMode === "args" ||
                    egg.invocationMode === "shell"
                      ? egg.invocationMode
                      : "env",
                  minDisk: egg.minDisk,
                  minMemory: egg.minMemory,
                  mountPath: egg.mountPath,
                  name: egg.name,
                  scriptContainer: egg.scriptContainer,
                  scriptEntry: egg.scriptEntry,
                  scriptInstall: egg.scriptInstall,
                  startup: egg.startup,
                  volumeOwner: egg.volumeOwner,
                }}
              />
            </PanelCard>
          </Panel>
          <Panel title={`Variables (${egg.variables.length})`}>
            <PanelCard>
              <VariablesEditor
                eggId={egg.id}
                initial={egg.variables.map((v) => ({
                  defaultValue: v.defaultValue,
                  description: v.description,
                  envVariable: v.envVariable,
                  name: v.name,
                  rules: v.rules,
                  userEditable: v.userEditable,
                  userViewable: v.userViewable,
                }))}
              />
            </PanelCard>
          </Panel>
        </div>
      </PageBody>
    </>
  );
};

export default AdminEggPage;
