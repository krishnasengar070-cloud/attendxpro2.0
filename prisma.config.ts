import "dotenv/config";
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "node --env-file-if-exists=.env scripts/seed.mjs" },
  datasource: { url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "postgresql://localhost/attendx" }
});
