import { AI_COMMANDS } from "./aiCommands.ts";
import type { AiCommandItem, AiContextAnchor } from "./aiChatTypes.ts";

export interface ActiveCommandTrigger {
	start: number;
	end: number;
	rawToken: string;
	query: string;
}

export interface RankedAiCommandItem {
	item: AiCommandItem;
	isContextual: boolean;
	isAlreadyUsed: boolean;
}

const COMMAND_SET = new Set(AI_COMMANDS.map((item) => item.command.toLowerCase()));

const COMMAND_KEYWORDS: Record<string, readonly string[]> = {
	"@scene": ["сцена", "опис", "деталі", "перевірка", "dc", "scene", "clue"],
	"@npc": ["нпс", "ніп", "персонаж", "герой", "npc", "character"],
	"@encounter": ["бій", "бойова", "сутичка", "енкаунтер", "баланс", "encounter", "combat", "fight"],
	"@bestiary": ["бестіарій", "монстр", "істота", "статблок", "bestiary", "monster", "creature"],
	"@location": ["локація", "місце", "таверна", "місто", "фракція", "location", "place", "dungeon"],
	"@notes": ["нотатки", "замітки", "підсумок", "квест", "notes", "summary", "recap"],
	"@rules": ["правила", "заклинання", "стан", "механіка", "rules", "spell", "condition"],
	"@dice": ["дайси", "кубик", "кидок", "перевірка", "dice", "roll", "d20"],
};

const ACTIVE_COMMAND_TRIGGER_REGEX = /(^|[\s,(])(@([a-zA-Zа-яА-ЯіїєґІЇЄҐ]*))$/;
const WORD_CHAR_REGEX = /[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/;
const USED_COMMAND_TOKEN_REGEX = /(^|[\s,(])@([a-zA-Z]+)(?!\[)(?=\s|$|[.,;:!?])/g;

function getContextualConfig(
	anchorType?: AiContextAnchor["type"],
	isBestiaryOpen = false,
): { priority: readonly string[]; badges: ReadonlySet<string> } {
	if (isBestiaryOpen || anchorType === "bestiary") {
		return {
			priority: ["@bestiary", "@encounter", "@rules"],
			badges: new Set(["@bestiary"]),
		};
	}
	if (anchorType === "encounter") {
		return {
			priority: ["@encounter", "@bestiary", "@dice"],
			badges: new Set(["@encounter", "@bestiary"]),
		};
	}
	if (anchorType === "session") {
		return {
			priority: ["@scene", "@notes", "@npc", "@encounter"],
			badges: new Set(["@scene", "@notes"]),
		};
	}
	return {
		priority: ["@npc", "@location", "@scene", "@bestiary", "@encounter", "@notes", "@rules", "@dice"],
		badges: new Set<string>(),
	};
}

function getQueryMatchScore(item: AiCommandItem, normalizedQuery: string): number {
	const cmdKey = item.command.slice(1).toLowerCase();
	const name = item.name.toLowerCase();
	const desc = item.description.toLowerCase();
	const keywords = COMMAND_KEYWORDS[item.command] || [];

	if (cmdKey.startsWith(normalizedQuery)) return 4;
	if (name.startsWith(normalizedQuery) || keywords.some((kw) => kw.startsWith(normalizedQuery))) {
		return 3;
	}
	if (
		cmdKey.includes(normalizedQuery) ||
		name.includes(normalizedQuery) ||
		keywords.some((kw) => kw.includes(normalizedQuery))
	) {
		return 2;
	}
	if (desc.includes(normalizedQuery)) return 1;
	return 0;
}

/** Finds an active `@command` prefix token immediately before the caret without triggering inside emails or mid-word. */
export function findActiveCommandTrigger(
	value: string,
	caretOffset: number,
): ActiveCommandTrigger | null {
	const text = String(value || "");
	const clampedCaret = Math.max(0, Math.min(text.length, Number(caretOffset) || 0));
	const charAfterCaret = text.slice(clampedCaret, clampedCaret + 1);
	if (charAfterCaret && WORD_CHAR_REGEX.test(charAfterCaret)) {
		return null;
	}

	const prefix = text.slice(0, clampedCaret);
	const match = prefix.match(ACTIVE_COMMAND_TRIGGER_REGEX);
	if (!match || match.index === undefined) return null;

	const start = match.index + match[1].length;
	return {
		start,
		end: clampedCaret,
		rawToken: match[2],
		query: match[3] || "",
	};
}

/** Collects valid `@commands` already present in the message outside the currently edited token span. */
export function extractUsedCommands(
	value: string,
	excludeRange?: { start: number; end: number },
): Set<string> {
	const raw = String(value || "");
	const text =
		excludeRange && excludeRange.end > excludeRange.start
			? `${raw.slice(0, excludeRange.start)} ${raw.slice(excludeRange.end)}`
			: raw;

	const used = new Set<string>();
	for (const match of text.matchAll(USED_COMMAND_TOKEN_REGEX)) {
		const cmd = `@${String(match[2] || "").toLowerCase()}`;
		if (COMMAND_SET.has(cmd)) {
			used.add(cmd);
		}
	}
	return used;
}

/** Filters and ranks `@` commands by English/Ukrainian query, active workspace context, and prior usage. */
export function getSuggestedAiCommands({
	query,
	anchorType,
	isBestiaryOpen = false,
	usedCommands,
}: {
	query: string;
	anchorType?: AiContextAnchor["type"];
	isBestiaryOpen?: boolean;
	usedCommands?: ReadonlySet<string>;
}): RankedAiCommandItem[] {
	const normalizedQuery = String(query || "").trim().toLowerCase();
	const { priority, badges } = getContextualConfig(anchorType, isBestiaryOpen);

	const getPriorityRank = (command: string): number => {
		const idx = priority.indexOf(command);
		return idx === -1 ? priority.length : idx;
	};

	const candidates = AI_COMMANDS.map((item, defaultIndex) => {
		const score = normalizedQuery ? getQueryMatchScore(item, normalizedQuery) : 1;
		return {
			item,
			score,
			defaultIndex,
			priorityRank: getPriorityRank(item.command),
			isContextual: badges.has(item.command),
			isAlreadyUsed: Boolean(usedCommands?.has(item.command)),
		};
	}).filter((entry) => entry.score > 0);

	candidates.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		if (a.isAlreadyUsed !== b.isAlreadyUsed) return a.isAlreadyUsed ? 1 : -1;
		if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
		return a.defaultIndex - b.defaultIndex;
	});

	return candidates.map(({ item, isContextual, isAlreadyUsed }) => ({
		item,
		isContextual,
		isAlreadyUsed,
	}));
}

/** Replaces the active `@query` span with the chosen `@command` and returns the updated text and caret offset after trailing space. */
export function applyCommandAutocomplete(
	value: string,
	trigger: ActiveCommandTrigger,
	command: string,
): { nextValue: string; nextCaretOffset: number } {
	const text = String(value || "");
	const before = text.slice(0, trigger.start);
	const after = text.slice(trigger.end);
	const hasTrailingSpace = after.startsWith(" ");
	const inserted = hasTrailingSpace ? command : `${command} `;
	const nextCaretOffset = before.length + command.length + 1;
	return {
		nextValue: `${before}${inserted}${after}`,
		nextCaretOffset,
	};
}
