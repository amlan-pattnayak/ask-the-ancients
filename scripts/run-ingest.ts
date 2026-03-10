import { config } from "dotenv";
config({ path: ".env.local" });

// Dynamic import to ensure env is loaded first
await import("./ingest-texts");
