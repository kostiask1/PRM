const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const jsonWriteQueues = new Map();

async function ensureDir(dirPath) {
	await fs.mkdir(dirPath, { recursive: true });
}

async function exists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function getFileSize(filePath) {
	try {
		const stats = await fs.stat(filePath);
		return stats.isFile() ? stats.size : 0;
	} catch {
		return 0;
	}
}

async function getDirectorySize(dirPath) {
	if (!(await exists(dirPath))) return 0;
	let total = 0;
	const entries = await fs.readdir(dirPath, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dirPath, entry.name);
		if (entry.isDirectory()) {
			total += await getDirectorySize(fullPath);
		} else if (entry.isFile()) {
			total += await getFileSize(fullPath);
		}
	}
	return total;
}

function stripUpdatedAtFields(value) {
	if (Array.isArray(value)) {
		return value.map(stripUpdatedAtFields);
	}
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value)
			.filter(([key]) => key !== "updatedAt")
			.map(([key, entryValue]) => [key, stripUpdatedAtFields(entryValue)]),
	);
}

async function readJson(filePath) {
	const raw = await fs.readFile(filePath, "utf8");
	return stripUpdatedAtFields(JSON.parse(raw));
}

async function writeJson(filePath, value) {
	const resolvedPath = path.resolve(filePath);
	const previousWrite = jsonWriteQueues.get(resolvedPath) || Promise.resolve();
	const queuedWrite = previousWrite
		.catch(() => {})
		.then(() => writeJsonNow(resolvedPath, value));
	const storedWrite = queuedWrite
		.catch(() => {})
		.finally(() => {
			if (jsonWriteQueues.get(resolvedPath) === storedWrite) {
				jsonWriteQueues.delete(resolvedPath);
			}
		});
	jsonWriteQueues.set(resolvedPath, storedWrite);
	return queuedWrite;
}

async function writeJsonNow(filePath, value) {
	await ensureDir(path.dirname(filePath));
	const content = JSON.stringify(stripUpdatedAtFields(value), null, 2);
	const tempPath = path.join(
		path.dirname(filePath),
		`.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto
			.randomBytes(6)
			.toString("hex")}.tmp`,
	);
	try {
		await fs.writeFile(tempPath, content, "utf8");
		await renameWithRetry(tempPath, filePath);
	} catch (error) {
		await fs.rm(tempPath, { force: true }).catch(() => {});
		throw error;
	}
}

function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renameWithRetry(oldPath, newPath, retries = 12, delay = 50) {
	for (let i = 0; i < retries; i++) {
		try {
			await fs.rename(oldPath, newPath);
			return;
		} catch (error) {
			const isLocked = ["EPERM", "EBUSY", "EACCES"].includes(error.code);
			if (isLocked && i < retries - 1) {
				await wait(delay * (i + 1));
				continue;
			}
			throw error;
		}
	}
}

module.exports = {
	ensureDir,
	exists,
	getDirectorySize,
	getFileSize,
	readJson,
	renameWithRetry,
	stripUpdatedAtFields,
	writeJson,
};
