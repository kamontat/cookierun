/**
 * Publishes to Cloudflare through `bunx` for the same reason check-type.ts
 * does: running this file directly does not put node_modules/.bin on PATH the
 * way an npm-style script does.
 *
 * `wrangler.jsonc` carries `build.command: bun run build` and serves `dist/`,
 * so this does not build first - wrangler does. Arguments are forwarded, which
 * is what keeps `bun run deploy --dry-run` working.
 */
import { execAsync } from "./utils/shell";

await execAsync("wrangler", "deploy", ...Bun.argv.slice(2));
