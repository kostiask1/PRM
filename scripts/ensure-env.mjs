import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(currentDir, "..", ".env");

try {
	await writeFile(envPath, "GEMINI_API_KEY=", {
		encoding: "utf8",
		flag: "wx",
	});
} catch (error) {
	if (error.code !== "EEXIST") {
		throw error;
	}
}
