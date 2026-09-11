/**
 * `tsc --noEmit` over the whole project, test files included. `execAsync` runs
 * it through Bun Shell, which resolves `node_modules/.bin` itself - running
 * this file directly would not put that directory on PATH the way an npm-style
 * script does.
 */
import { execAsync } from "./utils/shell";

await execAsync("tsc", "--noEmit", ...Bun.argv.slice(2));
