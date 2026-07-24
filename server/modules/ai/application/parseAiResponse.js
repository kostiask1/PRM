function stripOuterJsonFence(text) {
	const trimmed = String(text || "").trim();
	const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	return match ? match[1].trim() : trimmed;
}

function createJsonObjectScanState() {
	return {
		depth: 0,
		inString: false,
		escaped: false,
	};
}

function advanceJsonStringState(state, char) {
	if (state.escaped) {
		state.escaped = false;
		return;
	}
	if (char === "\\") {
		state.escaped = true;
		return;
	}
	if (char === '"') state.inString = false;
}

function advanceJsonStructureState(state, char) {
	if (char === '"') {
		state.inString = true;
		return false;
	}
	if (char === "{") {
		state.depth += 1;
		return false;
	}
	if (char !== "}") return false;
	state.depth -= 1;
	return state.depth === 0;
}

function isJsonObjectEnd(state, char) {
	if (state.inString) {
		advanceJsonStringState(state, char);
		return false;
	}
	return advanceJsonStructureState(state, char);
}

function findJsonObjectEnd(source, firstBrace) {
	const state = createJsonObjectScanState();
	for (let index = firstBrace; index < source.length; index += 1) {
		if (isJsonObjectEnd(state, source[index])) return index;
	}
	return -1;
}

function extractFirstJsonObject(text) {
	const source = stripOuterJsonFence(text);
	const firstBrace = source.indexOf("{");
	if (firstBrace === -1) return source.trim();
	const lastBrace = findJsonObjectEnd(source, firstBrace);
	if (lastBrace === -1) return source.trim();
	return source.slice(firstBrace, lastBrace + 1).trim();
}

function normalizeEscapedNewLinesInObject(value) {
	const normalized = {};
	for (const key in value) {
		normalized[key] = normalizeEscapedNewLines(value[key]);
	}
	return normalized;
}

function normalizeNonStringEscapedNewLines(value) {
	if (Array.isArray(value)) return value.map(normalizeEscapedNewLines);
	if (!value) return value;
	if (typeof value !== "object") return value;
	return normalizeEscapedNewLinesInObject(value);
}

function normalizeEscapedNewLines(value) {
	if (typeof value === "string") return value.replace(/\\n/g, "\n");
	return normalizeNonStringEscapedNewLines(value);
}

function normalizeRawAiText(text) {
	return String(text || "").replace(/\\n/g, "\n");
}

function parseStructuredAiResponse(text) {
	return normalizeEscapedNewLines(JSON.parse(extractFirstJsonObject(text)));
}

function createInvalidAiResponse(text) {
	return {
		error: "AI returned invalid JSON. Try again.",
		raw_response: normalizeRawAiText(text),
	};
}

function parseAiResponseText({ text, shouldParse, onParseError = console.error }) {
	if (!shouldParse) return normalizeRawAiText(text);
	try {
		return parseStructuredAiResponse(text);
	} catch (error) {
		onParseError("Failed to parse AI response as JSON:", text, error);
		return createInvalidAiResponse(text);
	}
}

module.exports = {
	extractFirstJsonObject,
	normalizeEscapedNewLines,
	parseAiResponseText,
	stripOuterJsonFence,
};
