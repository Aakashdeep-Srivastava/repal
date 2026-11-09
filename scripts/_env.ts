/**
 * Side-effect module: load local env for standalone scripts. Import this FIRST
 * (before any `@/lib/*` module) so values like PAYPAL_BASE — computed at import
 * time from process.env — see the local .env.local / .env.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config(); // .env (does not override already-set keys)
