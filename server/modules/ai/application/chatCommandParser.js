const SUPPORTED_CHAT_COMMANDS = Object.freeze([
	"scene",
	"npc",
	"encounter",
	"bestiary",
	"location",
	"notes",
	"rules",
	"dice",
]);

const COMMAND_SET = new Set(SUPPORTED_CHAT_COMMANDS);
const ENTITY_TAG_MENTION_REGEX = /@(?:npc|character|location|scene|monster)\[([^[\]\n]+)\]/gi;
const DOUBLE_BRACKET_MENTION_REGEX = /\[\[([^[\]\n]+)\]\]/g;
const NATIVE_BRACKET_MENTION_REGEX = /\[([^[\]\n]+)\](?:\{([^}\n]+)\})?(?!\()/g;
const COMMAND_TOKEN_REGEX = /(^|[\s,(])@([a-zA-Z]+)(?!\[)(?=\s|$|[.,;:!?])/g;
const DICE_FORMULA_REGEX = /(?:^|[^\w])(\d{1,3})d(\d{1,4})(?:\s*([+-])\s*(\d{1,4}))?(?=$|[^\w])/gi;

const MAX_DICE_ROLLS_PER_MESSAGE = 5;

/**
 * Extracts supported @commands from a user chat message while preserving order.
 */
function parseChatCommands(text) {
	const source = String(text || "");
	const commands = [];
	const seen = new Set();

	for (const match of source.matchAll(COMMAND_TOKEN_REGEX)) {
		const cmd = String(match[2] || "").toLowerCase();
		if (!COMMAND_SET.has(cmd) || seen.has(cmd)) continue;
		seen.add(cmd);
		commands.push(cmd);
	}

	const cleanedText = source
		.replace(COMMAND_TOKEN_REGEX, (full, prefix, cmd) =>
			COMMAND_SET.has(String(cmd || "").toLowerCase()) ? prefix : full,
		)
		.replace(/\s{2,}/g, " ")
		.trim();

	return {
		primaryCommand: commands[0] || null,
		commands,
		cleanedText,
	};
}

/**
 * Extracts entity mention names from native brackets, double brackets, or typed @tag[Name].
 */
function extractMentionedEntityNames(text) {
	const source = String(text || "");
	const seen = new Set();
	const names = [];

	const addName = (raw) => {
		const normalized = String(raw || "").trim();
		if (!normalized) return;
		const key = normalized.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		names.push(normalized);
	};

	for (const match of source.matchAll(ENTITY_TAG_MENTION_REGEX)) {
		addName(match[1]);
	}
	for (const match of source.matchAll(DOUBLE_BRACKET_MENTION_REGEX)) {
		addName(match[1]);
	}
	for (const match of source.matchAll(NATIVE_BRACKET_MENTION_REGEX)) {
		addName(match[1]);
	}

	return names;
}

/**
 * Converts typed entity tags and double-bracket mentions into the app's native [Name] syntax.
 */
function normalizeChatMentionsSyntax(text) {
	return String(text || "")
		.replace(ENTITY_TAG_MENTION_REGEX, (_full, name) => `[${String(name).trim()}]`)
		.replace(DOUBLE_BRACKET_MENTION_REGEX, (_full, name) => `[${String(name).trim()}]`);
}

/**
 * Evaluates up to five XdY(+/-Z) dice expressions present in text using randomFn.
 */
function evaluateDiceExpressions(text, randomFn = Math.random) {
	const source = String(text || "");
	const results = [];

	for (const match of source.matchAll(DICE_FORMULA_REGEX)) {
		if (results.length >= MAX_DICE_ROLLS_PER_MESSAGE) break;
		const count = Number.parseInt(match[1], 10);
		const sides = Number.parseInt(match[2], 10);
		if (!Number.isFinite(count) || !Number.isFinite(sides)) continue;
		if (count < 1 || count > 100 || sides < 2 || sides > 1000) continue;

		const sign = match[3] === "-" ? -1 : 1;
		const absModifier = match[4] ? Number.parseInt(match[4], 10) : 0;
		const modifier = Number.isFinite(absModifier) ? sign * absModifier : 0;

		const rolls = [];
		let sum = 0;
		for (let i = 0; i < count; i += 1) {
			const rolled = Math.floor(randomFn() * sides) + 1;
			const clamped = Math.min(sides, Math.max(1, rolled));
			rolls.push(clamped);
			sum += clamped;
		}

		const expression = modifier === 0
			? `${count}d${sides}`
			: `${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier}`;

		results.push({
			expression,
			rolls,
			modifier,
			total: sum + modifier,
		});
	}

	return results;
}

module.exports = {
	SUPPORTED_CHAT_COMMANDS,
	parseChatCommands,
	extractMentionedEntityNames,
	normalizeChatMentionsSyntax,
	evaluateDiceExpressions,
};
