/**
 * Formatting and lint, through `bunx` for the same reason check-type.ts does:
 * running this file directly does not put node_modules/.bin on PATH the way an
 * npm-style script does.
 *
 * `check` reports without touching anything. Pass `--write` to have Biome apply
 * what it can - the arguments are forwarded, so `bun run check:biome --write`
 * works.
 */
import { execAsync } from "./utils/shell";

await execAsync("biome", "check", "--write", "--unsafe", ...Bun.argv.slice(2));
