import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "..");
const isWindows = process.platform === "win32";
const appPort = process.env.PORT || "5000";
const appUrl = `http://localhost:${appPort}/`;
const sourceEntries = [
	"src",
	"server",
	"database",
	"data",
	"scripts",
	"public",
	"index.html",
	"package.json",
	"package-lock.json",
	"vite.config.js",
	".env",
];

function run(command, args, options = {}) {
	const { label = `${command} ${args.join(" ")}`, ...spawnOptions } = options;
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: rootDir,
			stdio: "inherit",
			shell: isWindows,
			...spawnOptions,
		});

		child.on("error", (error) => {
			reject(new Error(`${label} could not start: ${error.message}`));
		});
		child.on("exit", (code, signal) => {
			if (code === 0) {
				resolve();
				return;
			}

			const reason = signal ? `signal ${signal}` : `exit code ${code}`;
			reject(new Error(`${label} failed with ${reason}.`));
		});
	});
}

async function exists(targetPath) {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
}

async function* filesUnder(entryPath) {
	const stats = await fs.stat(entryPath);
	if (!stats.isDirectory()) {
		yield { filePath: entryPath, stats };
		return;
	}

	const entries = await fs.readdir(entryPath, { withFileTypes: true });
	for (const entry of entries) {
		const childPath = path.join(entryPath, entry.name);
		if (entry.isDirectory()) {
			yield* filesUnder(childPath);
		} else if (entry.isFile()) {
			yield { filePath: childPath, stats: await fs.stat(childPath) };
		}
	}
}

async function needsBuild() {
	const distIndexPath = path.join(rootDir, "dist", "index.html");
	if (!(await exists(distIndexPath))) {
		return true;
	}

	const distIndexStats = await fs.stat(distIndexPath);
	for (const entry of sourceEntries) {
		const entryPath = path.join(rootDir, entry);
		if (!(await exists(entryPath))) {
			continue;
		}

		for await (const sourceFile of filesUnder(entryPath)) {
			if (sourceFile.filePath === distIndexPath) {
				continue;
			}

			if (sourceFile.stats.mtimeMs > distIndexStats.mtimeMs) {
				return true;
			}
		}
	}

	return false;
}

async function needsInstall() {
	const nodeModulesPath = path.join(rootDir, "node_modules");
	const npmLockPath = path.join(nodeModulesPath, ".package-lock.json");
	if (!(await exists(nodeModulesPath)) || !(await exists(npmLockPath))) {
		return true;
	}

	const npmLockStats = await fs.stat(npmLockPath);
	for (const entry of ["package.json", "package-lock.json"]) {
		const entryPath = path.join(rootDir, entry);
		if (!(await exists(entryPath))) {
			continue;
		}

		const entryStats = await fs.stat(entryPath);
		if (entryStats.mtimeMs > npmLockStats.mtimeMs) {
			return true;
		}
	}

	return false;
}

function openBrowser(url) {
	const escapedPowerShellUrl = url.replace(/'/g, "''");
	const candidates = isWindows
		? [
				{
					command: "powershell.exe",
					args: [
						"-NoProfile",
						"-ExecutionPolicy",
						"Bypass",
						"-Command",
						`Start-Process '${escapedPowerShellUrl}'`,
					],
				},
				{
					command: "rundll32.exe",
					args: ["url.dll,FileProtocolHandler", url],
				},
			]
		: process.platform === "darwin"
			? [{ command: "open", args: [url] }]
			: [
					{ command: "xdg-open", args: [url] },
					{ command: "gio", args: ["open", url] },
					{ command: "sensible-browser", args: [url] },
				];

	return candidates.reduce(
		(previousAttempt, candidate) =>
			previousAttempt.catch(
				() =>
					new Promise((resolve, reject) => {
						const child = spawn(candidate.command, candidate.args, {
							cwd: rootDir,
							stdio: "ignore",
							windowsHide: true,
						});

						child.on("error", reject);
						child.on("exit", (code) => {
							if (code === 0) {
								resolve();
								return;
							}

							reject(
								new Error(
									`${candidate.command} failed with exit code ${code}.`,
								),
							);
						});
					}),
			),
		Promise.reject(new Error("No browser opener attempted.")),
	);
}

async function waitForServer(url, timeoutMs = 15000) {
	const deadline = Date.now() + timeoutMs;
	const healthUrl = new URL("/api/health", url);

	while (Date.now() < deadline) {
		try {
			const response = await fetch(healthUrl);
			if (response.ok) {
				return true;
			}
		} catch {
			// Server is still starting.
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	return false;
}

function scheduleBrowserOpen() {
	setTimeout(async () => {
		await waitForServer(appUrl);
		console.log(`Opening browser at ${appUrl}`);
		openBrowser(appUrl).catch((error) => {
			console.warn(
				`Could not open browser automatically: ${error.message} Open ${appUrl} manually.`,
			);
		});
	}, 3000);
}

function startProductionServer() {
	const server = spawn("npm", ["run", "start:prod"], {
		cwd: rootDir,
		stdio: "inherit",
		shell: isWindows,
	});

	const shutdown = () => {
		if (!server.killed) {
			server.kill("SIGTERM");
		}
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	server.on("error", (error) => {
		console.error(`Production server could not start: ${error.message}`);
		process.exit(1);
	});
	server.on("exit", (code) => {
		process.exit(code ?? 0);
	});

	return server;
}

async function main() {
	console.log("Pulling latest changes...");
	await run("git", ["pull"], { label: "git pull" });

	if (await needsInstall()) {
		console.log("Installing node modules...");
		await run("npm", ["install"], { label: "npm install" });
	}

	if (await needsBuild()) {
		console.log("Building project...");
		await run("npm", ["run", "build"], { label: "npm run build" });
	} else {
		console.log("Using existing build from dist\\");
	}

	console.log(`Starting production server at ${appUrl}`);
	startProductionServer();
	scheduleBrowserOpen();
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
