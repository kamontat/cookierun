import { exit } from "node:process";
import { styleText } from "node:util";
import { $ } from "bun";

const printCmd = (cmd: string, arg: string) => {
	const prefix = styleText(["dim", "cyan"], "$");
	const msg = styleText(["dim", "gray"], `${cmd} ${arg}`);
	console.log(`${prefix} ${msg}`);
};

export const execAsync = async (cmd: string, ...args: string[]) => {
	printCmd(cmd, args.join(" "));

	const { exitCode } = await $`${cmd} ${args}`.nothrow();
	exit(exitCode);
};
