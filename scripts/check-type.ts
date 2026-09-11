/**
 * `bunx`, not a bare `tsc`: running this file directly does not put
 * node_modules/.bin on PATH the way an npm-style script does.
 */
import { $ } from "bun";

const { exitCode } = await $`bunx tsc --noEmit ${Bun.argv.slice(2)}`.nothrow();

process.exit(exitCode);
