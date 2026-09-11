/**
 * `bun test` by way of a file, so package.json holds a delegation rather than
 * a command. Arguments are forwarded, which is what keeps `bun run test -t
 * "decodes every slot"` working, and the child's exit code is propagated so a
 * failure still fails whatever called it. CI runs `bun test` directly, so
 * this is for every other caller.
 */
import { $ } from "bun";

const { exitCode } = await $`bun test ${Bun.argv.slice(2)}`.nothrow();

process.exit(exitCode);
