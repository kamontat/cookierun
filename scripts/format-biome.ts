/**
 * The writing half of the Biome pair. `check:biome` reports and changes
 * nothing; this runs the same check with `--write --unsafe`, so it also
 * applies the fixes Biome itself flags as possibly behaviour-changing.
 *
 * Reach for `bun run check:biome --write` when the safe fixes are enough, and
 * read the diff after this one. Arguments are forwarded either way.
 */
import { execAsync } from "./utils/shell";

await execAsync("biome", "check", "--write", "--unsafe", ...Bun.argv.slice(2));
