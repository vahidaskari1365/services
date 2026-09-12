// Seed دستی — bun scripts/seed.ts
// توجه: سیستم به‌صورت خودکار هم در اولین لاگین seed می‌کند (src/lib/seed.ts → ensureSeeded)

import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/lib/seed";

const db = new PrismaClient();

seedDatabase(db)
  .then(() => console.log("Seed done."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
