import { config } from "dotenv";

// Load .env.local for tsx scripts (Next.js loads it itself for the app).
config({ path: ".env.local" });
