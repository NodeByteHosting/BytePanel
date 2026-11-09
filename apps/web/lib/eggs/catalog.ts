import "server-only";
import { prisma } from "@/lib/db";

export const loadEggCatalog = async (options: { includeDisabled: boolean }) => {
  const eggs = await prisma.egg.findMany({
    include: { nest: true, variables: { orderBy: { sort: "asc" } } },
    orderBy: [{ nest: { name: "asc" } }, { name: "asc" }],
    where: options.includeDisabled ? {} : { enabled: true },
  });
  return eggs.map((egg) => ({
    description: egg.description,
    dockerImages: egg.dockerImages as Record<string, string>,
    id: egg.id,
    image: egg.image,
    minDisk: egg.minDisk,
    minMemory: egg.minMemory,
    name: egg.name,
    nest: egg.nest.name,
    ports: Math.max(
      1,
      Array.isArray(egg.containerPorts) ? egg.containerPorts.length : 0
    ),
    slug: egg.slug,
    variables: egg.variables
      .filter(
        (v) => options.includeDisabled || (v.userViewable && v.userEditable)
      )
      .map((v) => ({
        defaultValue: v.defaultValue,
        description: v.description,
        editable: true,
        envVariable: v.envVariable,
        name: v.name,
        rules: v.rules,
      })),
  }));
};

export type EggCatalogEntry = Awaited<
  ReturnType<typeof loadEggCatalog>
>[number];
