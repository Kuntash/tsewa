import { drizzle } from "drizzle-orm/d1";

import * as relations from "@/db/relations";
import * as schema from "@/db/schema";

export function createDatabase(database: D1Database) {
  return drizzle(database, { schema: { ...schema, ...relations } });
}

export type Database = ReturnType<typeof createDatabase>;
