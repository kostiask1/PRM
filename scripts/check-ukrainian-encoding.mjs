import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const ROOT = process.cwd();
const TARGET_DIRS = ["src", "server"];
const ALLOWED_EXTENSIONS = new Set([
	".js",
	".jsx",
	".mjs",
	".cjs",
	".css",
	".scss",
	".md",
]);

// Typical mojibake markers when UTF-8 text was decoded as Latin-1/Windows-1252.
const mojibakePattern = /(?:[ÐÑ][\u0080-\u00BF]|Ã[\u0080-\u00BF]|ï¿½|�)/u;

// Suspicious replacement with '?' inside Cyrillic word fragments.
const badQuestionMarkBetweenCyrillicPattern = /[\u0400-\u04FF]\?[\u0400-\u04FF]/u;

// Long runs of '?' are usually broken text placeholders, not code operators.
const suspiciousQuestionRunPattern = /\?{4,}/;

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function walk(dirPath, result = []) {
	if (!fs.existsSync(dirPath)) return result;
	for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === ".git") continue;
		const fullPath = path.join(dirPath, entry.name);
		if (entry.isDirectory()) {
			walk(fullPath, result);
		} else if (
			entry.isFile() &&
			ALLOWED_EXTENSIONS.has(path.extname(entry.name))
		) {
			result.push(fullPath);
		}
	}
	return result;
}

function relative(filePath) {
	return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function hasSuspiciousQuestionRuns(text) {
	if (!suspiciousQuestionRunPattern.test(text)) return false;

	// Ignore markdown horizontal rules and repeated separators made of '?'
	const lines = text.split(/\r?\n/);
	return lines.some((line) => {
		const trimmed = line.trim();
		if (!trimmed) return false;
		if (/^\?{4,}$/.test(trimmed)) return false;
		return /\?{4,}/.test(trimmed);
	});
}

const files = TARGET_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
const errors = [];

for (const filePath of files) {
	const bytes = fs.readFileSync(filePath);
	let text;

	try {
		text = utf8Decoder.decode(bytes);
	} catch {
		errors.push(`${relative(filePath)}: invalid UTF-8 encoding`);
		continue;
	}

	if (mojibakePattern.test(text)) {
		errors.push(`${relative(filePath)}: possible mojibake symbols found`);
	}

	if (badQuestionMarkBetweenCyrillicPattern.test(text)) {
		errors.push(`${relative(filePath)}: suspicious '?' inside Cyrillic word`);
	}

	if (hasSuspiciousQuestionRuns(text)) {
		errors.push(`${relative(filePath)}: suspicious long run of '?' found`);
	}
}

if (errors.length > 0) {
	console.error("Ukrainian text/encoding check failed:");
	for (const error of errors) {
		console.error(`- ${error}`);
	}
	process.exit(1);
}

console.log(`Encoding check passed for ${files.length} files.`);
