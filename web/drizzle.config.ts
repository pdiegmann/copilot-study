import { defineConfig } from "drizzle-kit";

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) dbUrl = "file:/home/bun/data/config/main.db";
export default defineConfig({
  // Revert back to main schema export file
  schema: "./src/lib/server/db/schema.ts",
  dialect: "sqlite",

  dbCredentials: {
    url: dbUrl
  },

  verbose: true,
  strict: true
});
