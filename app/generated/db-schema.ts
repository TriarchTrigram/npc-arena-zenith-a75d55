import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/** Table for the "progress_saves" entity (Progress saves) */
export const progressSaves = sqliteTable("progress_saves", {
  id: text("id").primaryKey(),
  save: text("save", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/** Type registry mapping slugs to row types */
export type EntityRegistry = {
  "progress_saves": typeof progressSaves.$inferSelect;
};

/** Foreign keys per table: camelCase column → the referenced table's slug (from `x-ref`) */
export type EntityRefs = {
  "progress_saves": {};
};

