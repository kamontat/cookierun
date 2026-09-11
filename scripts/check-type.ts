/**
 * `bunx`, not a bare `tsc`: running this file directly does not put
 * node_modules/.bin on PATH the way an npm-style script does.
 */
import { execAsync } from "./utils/shell";

await execAsync("tsc", "--noEmit", ...Bun.argv.slice(2));
