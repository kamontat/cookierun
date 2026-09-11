/**
 * Publishes to Cloudflare. `execAsync` runs wrangler through Bun Shell, which
 * resolves `node_modules/.bin` itself.
 *
 * `wrangler.jsonc` carries `build.command: bun run build` and serves `dist/`,
 * so this does not build first - wrangler does. Arguments are forwarded, which
 * is what keeps `bun run deploy --dry-run` working.
 */
import { execAsync } from "./utils/shell";

await execAsync("wrangler", "deploy", ...Bun.argv.slice(2));
