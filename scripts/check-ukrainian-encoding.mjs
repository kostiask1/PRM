import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const ROOT = process.cwd();
const TARGET_DIRS = ["src", "server"];
const ALLOWED_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".css", ".scss", ".md"]);

const mojibakePattern = /(Ð|Ñ|â€™|â€œ|â€|â€“|â€”|�)/;
const badQuestionMarkPattern = /[А-Яа-яІіЇїЄєҐґ]\?[А-Яа-яІіЇїЄєҐґ]/u;

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function walk(dirPath, result = []) {
	if (!fs.existsSync(dirPath)) return result;
	for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === ".git") continue;
		const fullPath = path.join(dirPath, entry.name);
		if (entry.isDirectory()) {
			walk(fullPath, result);
		} else if (entry.isFile() && ALLOWED_EXTENSIONS.has(path.extname(entry.name))) {
			result.push(fullPath);
		}
	}
	return result;
}

function relative(filePath) {
	return path.relative(ROOT, filePath).replace(/\\/g, "/");
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

	if (badQuestionMarkPattern.test(text)) {
		errors.push(`${relative(filePath)}: suspicious '?' inside Ukrainian word`);
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
