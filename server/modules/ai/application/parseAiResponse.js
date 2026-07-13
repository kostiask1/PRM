function stripOuterJsonFence(text) {
	const trimmed = String(text || "").trim();
	const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	return match ? match[1].trim() : trimmed;
}

function extractFirstJsonObject(text) {
	const source = stripOuterJsonFence(text);
	const firstBrace = source.indexOf("{");
	if (firstBrace === -1) return source.trim();
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let index = firstBrace; index < source.length; index += 1) {
		const char = source[index];
		if (inString) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === '"') inString = false;
			continue;
		}
		if (char === '"') inString = true;
		else if (char === "{") depth += 1;
		else if (char === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(firstBrace, index + 1).trim();
		}
	}
	return source.trim();
}

function normalizeEscapedNewLines(value) {
	if (typeof value === "string") return value.replace(/\\n/g, "\n");
	if (Array.isArray(value)) return value.map(normalizeEscapedNewLines);
	if (value && typeof value === "object") {
		const normalized = {};
		for (const key in value) {
			normalized[key] = normalizeEscapedNewLines(value[key]);
		}
		return normalized;
	}
	return value;
}

function parseAiResponseText({ text, shouldParse, onParseError = console.error }) {
	if (!shouldParse) return String(text || "").replace(/\\n/g, "\n");
	try {
		return normalizeEscapedNewLines(JSON.parse(extractFirstJsonObject(text)));
	} catch (error) {
		onParseError("Failed to parse AI response as JSON:", text, error);
		return {
			error: "AI returned invalid JSON. Try again.",
			raw_response: String(text || "").replace(/\\n/g, "\n"),
		};
	}
}

module.exports = {
	extractFirstJsonObject,
	normalizeEscapedNewLines,
	parseAiResponseText,
	stripOuterJsonFence,
};
