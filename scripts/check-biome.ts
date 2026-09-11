/**
 * Formatting and lint, reporting without touching anything. Pass `--write` to
 * have Biome apply what it can on its own - the arguments are forwarded, so
 * `bun run check:biome --write` works. `format:biome` is the same check with
 * `--write --unsafe` already applied.
 */
import { execAsync } from "./utils/shell";

await execAsync("biome", "check", ...Bun.argv.slice(2));
