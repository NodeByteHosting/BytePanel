import { NextResponse } from "next/server";

import { applicationHandler } from "@/lib/application/handler";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export const GET = applicationHandler(async () => {
  const [plans, eggs, locations] = await Promise.all([
    prisma.plan.findMany({
      orderBy: [{ sort: "asc" }, { name: "asc" }],
      where: { active: true },
    }),
    prisma.egg.findMany({
      include: {
        variables: {
          orderBy: { sort: "asc" },
          where: { userEditable: true },
        },
      },
      orderBy: { name: "asc" },
      where: { enabled: true },
    }),
    prisma.location.findMany({ orderBy: { short: "asc" } }),
  ]);

  return NextResponse.json({
    eggs: eggs.map((egg) => ({
      id: egg.id,
      name: egg.name,
      slug: egg.slug,
      variables: egg.variables.map((v) => ({
        default: v.defaultValue,
        description: v.description,
        env: v.envVariable,
        name: v.name,
        rules: v.rules,
      })),
    })),
    locations: locations.map((l) => ({
      id: l.id,
      long: l.long,
      short: l.short,
    })),
    plans: plans.map((p) => ({
      allocationLimit: p.allocationLimit,
      backupLimit: p.backupLimit,
      cpu: p.cpu,
      disk: p.disk,
      id: p.id,
      locationId: p.locationId,
      memory: p.memory,
      name: p.name,
    })),
  });
});
