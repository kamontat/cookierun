/**
 * What the page says about itself: which commit it was built from and when.
 *
 * The two values arrive as `BUN_PUBLIC_*` environment variables, which the
 * production build rewrites into string literals (`env: "BUN_PUBLIC_*"` in
 * `bun-server build`). Nothing else rewrites them - the dev server inlines
 * nothing and ships no `process` shim, and a local `bun run build` sets
 * neither - so both are absent far more often than they are present, and
 * every field here is nullable by design rather than by caution.
 */
export const REPO_URL = "https://github.com/kamontat/cookierun";

/**
 * Declared so the two reads below can be written as property access, which is
 * the only form the bundler rewrites - `noPropertyAccessFromIndexSignature`
 * would otherwise push them to bracket notation and the build would inline
 * nothing. Optional, because a build that sets neither is the ordinary case.
 */
declare module "bun" {
	interface Env {
		BUN_PUBLIC_COMMIT_SHA?: string;
		BUN_PUBLIC_BUILT_AT?: string;
	}
}

/** The two inlined strings, as they arrive: absent, empty, or a value. */
export type BuildEnv = {
	readonly commit: string | undefined;
	readonly builtAt: string | undefined;
};

export type BuildInfo = {
	readonly commit: string | null;
	readonly shortCommit: string | null;
	readonly commitUrl: string | null;
	readonly builtAt: Date | null;
};

/**
 * The build rewrites these two member expressions and leaves everything else
 * alone, so the reads have to be written exactly like this - a computed
 * `process.env[name]` is not rewritten, and an untouched `process` is a
 * ReferenceError in a browser. Hence the wrap: under the dev server this
 * throws on the first line and the page falls back to knowing nothing.
 */
function inlinedEnv(): BuildEnv {
	try {
		return {
			commit: process.env.BUN_PUBLIC_COMMIT_SHA,
			builtAt: process.env.BUN_PUBLIC_BUILT_AT,
		};
	} catch {
		return { commit: undefined, builtAt: undefined };
	}
}

/**
 * Defaults its argument the way `hrefFor` defaults its protocol: every caller
 * would otherwise pass the same thing, and the tests are the only caller that
 * ever passes anything else.
 */
export function readBuildInfo(env: BuildEnv = inlinedEnv()): BuildInfo {
	const commit = env.commit ? env.commit : null;
	const parsed = env.builtAt ? new Date(env.builtAt) : null;

	return {
		commit,
		shortCommit: commit === null ? null : commit.slice(0, 7),
		commitUrl: commit === null ? null : `${REPO_URL}/commit/${commit}`,
		builtAt: parsed !== null && !Number.isNaN(parsed.getTime()) ? parsed : null,
	};
}

/** UTC to the minute, so everyone reading the page reads the same string. */
export function formatBuiltAt(date: Date): string {
	return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
