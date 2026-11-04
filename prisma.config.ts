import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Match Next.js precedence: .env.local wins over .env (dotenv won't override).
config({ path: [".env.local", ".env"], quiet: true });

// Migrate / introspection commands need a direct (non-pooled) connection. The
// runtime PrismaClient in lib/db.ts uses @prisma/adapter-pg with the pooled
// DATABASE_URL — that path doesn't go through this config. Locally the two URLs
// are usually the same, so fall back to DATABASE_URL when the unpooled var
// isn't set.
const migrationUrl =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!migrationUrl) {
  throw new Error(
    "DATABASE_URL_UNPOOLED or DATABASE_URL must be set for Prisma migrations"
  );
}

export default defineConfig({
  datasource: {
    url: migrationUrl,
  },
  migrations: {
    path: "prisma/migrations",
  },
  schema: "prisma/schema.prisma",
});
