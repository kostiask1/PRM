import { lang } from "../../../../shared/lib/index.js";
import type {
	AiActionCardStat,
	AiActionCardStatKind,
	AiModelOption,
	CompactContextFeedback,
} from "./aiChatTypes.ts";

export function getChatDateLocale(language = lang.getLanguage()): string {
	return String(language || "").toLowerCase().startsWith("uk") ? "uk-UA" : "en-US";
}

export function getLocalizedChatTitle(session: {
	title?: string;
	isAutoTitled?: boolean;
	isLegacyArchive?: boolean;
}): string {
	const raw = String(session?.title || "").trim();
	if (
		session?.isLegacyArchive &&
		(!raw || raw === "Архів старого асистента" || raw === "Legacy assistant archive")
	) {
		return lang.t("Legacy assistant archive");
	}
	if (!raw || (!session?.isAutoTitled && (raw === "Новий діалог" || raw === "New chat"))) {
		return lang.t("New chat");
	}
	return raw;
}

export function formatChatRequestCount(count: number): string {
	return count === 1
		? lang.t("{count} request", { count })
		: lang.t("{count} requests", { count });
}

export function formatModelContextWindow(limit?: number): string | undefined {
	if (!limit || !Number.isFinite(limit) || limit <= 0) return undefined;
	if (limit >= 1000000) {
		const m = limit / 1000000;
		const count = Number.isInteger(m) ? m : m.toFixed(1);
		return lang.t("{count}M tokens", { count });
	}
	if (limit >= 1000) {
		return lang.t("{count}K tokens", { count: Math.round(limit / 1000) });
	}
	return lang.t("{count} tokens", { count: limit });
}

export function formatCompactContextWindow(contextWindow: string): string {
	return String(contextWindow || "")
		.replace(/\s*(?:tokens?|токен(?:ів|и|у)?)$/i, "")
		.trim();
}

export function formatActionCardTitle(title?: string): string {
	const trimmed = String(title || "").trim();
	if (!trimmed || trimmed === "Дія асистента" || trimmed === "Assistant action") {
		return lang.t("Assistant action");
	}
	return trimmed;
}

const LEGACY_STAT_LABEL_TO_KIND: Record<string, AiActionCardStatKind> = {
	персонаж: "character",
	персонажі: "character",
	character: "character",
	characters: "character",
	npc: "npc",
	локація: "location",
	локації: "location",
	location: "location",
	locations: "location",
	сутність: "entity",
	сутності: "entity",
	entity: "entity",
	entities: "entity",
	монстр: "monster",
	монстри: "monster",
	monster: "monster",
	monsters: "monster",
	нотатка: "note",
	нотатки: "note",
	note: "note",
	notes: "note",
	сесія: "session",
	сесії: "session",
	session: "session",
	sessions: "session",
	сцена: "scene",
	сцени: "scene",
	scene: "scene",
	scenes: "scene",
	"npc (сесія)": "session_npc",
	"npc (session)": "session_npc",
	"локація (сесія)": "session_location",
	"локації (сесія)": "session_location",
	"location (session)": "session_location",
	"locations (session)": "session_location",
	бій: "encounter",
	бої: "encounter",
	encounter: "encounter",
	encounters: "encounter",
};

function formatStatByKind(
	kind: AiActionCardStatKind,
	op: "added" | "changed" | "removed",
	count: number,
	delta = 0,
): string {
	if (kind === "words") {
		return lang.t("{delta} words", {
			delta: delta >= 0 ? `+${delta}` : String(delta),
		});
	}
	const sign = op === "removed" ? "-" : op === "changed" ? "~" : "+";
	const prefix = `${sign}${count}`;
	const isSingular = count === 1;

	switch (kind) {
		case "character":
			return isSingular
				? lang.t("{prefix} character", { prefix })
				: lang.t("{prefix} characters", { prefix });
		case "npc":
			return lang.t("{prefix} NPC", { prefix });
		case "location":
			return isSingular
				? lang.t("{prefix} location", { prefix })
				: lang.t("{prefix} locations", { prefix });
		case "entity":
			return isSingular
				? lang.t("{prefix} entity", { prefix })
				: lang.t("{prefix} entities", { prefix });
		case "monster":
			return isSingular
				? lang.t("{prefix} monster", { prefix })
				: lang.t("{prefix} monsters", { prefix });
		case "note":
			return isSingular
				? lang.t("{prefix} note", { prefix })
				: lang.t("{prefix} notes", { prefix });
		case "session":
			return isSingular
				? lang.t("{prefix} session", { prefix })
				: lang.t("{prefix} sessions", { prefix });
		case "scene":
			return isSingular
				? lang.t("{prefix} scene", { prefix })
				: lang.t("{prefix} scenes", { prefix });
		case "session_npc":
			return lang.t("{prefix} NPC (session)", { prefix });
		case "session_location":
			return isSingular
				? lang.t("{prefix} location (session)", { prefix })
				: lang.t("{prefix} locations (session)", { prefix });
		case "encounter":
			return isSingular
				? lang.t("{prefix} encounter", { prefix })
				: lang.t("{prefix} encounters", { prefix });
	}
}

export function formatActionCardStatValue(stat: AiActionCardStat): string {
	if (stat.kind) {
		return formatStatByKind(
			stat.kind,
			stat.op || "added",
			stat.count ?? 1,
			stat.delta ?? 0,
		);
	}

	const raw = String(stat.value || "").trim();
	const wordsMatch = raw.match(/^([+-]?\d+)\s+(?:слів|words)$/i);
	if (wordsMatch) {
		return formatStatByKind("words", "changed", 0, Number(wordsMatch[1]));
	}

	const countMatch = raw.match(/^([+~-])(\d+)\s+(.+)$/);
	if (countMatch) {
		const [, signChar, numStr, labelText] = countMatch;
		const mappedKind = LEGACY_STAT_LABEL_TO_KIND[labelText.trim().toLowerCase()];
		if (mappedKind) {
			const op =
				signChar === "-" ? "removed" : signChar === "~" ? "changed" : "added";
			return formatStatByKind(mappedKind, op, Number(numStr));
		}
	}

	return raw;
}

export function localizeAiModelOption(model: AiModelOption): AiModelOption {
	const rawContextWindow =
		model.inputTokenLimit !== undefined
			? formatModelContextWindow(model.inputTokenLimit)
			: model.contextWindow
				? lang.t(model.contextWindow)
				: undefined;
	return {
		...model,
		description: model.description ? lang.t(model.description) : "",
		...(model.badge ? { badge: lang.t(model.badge) } : {}),
		...(rawContextWindow ? { contextWindow: rawContextWindow } : {}),
	};
}

export function formatCompactContextFeedback(
	feedback: CompactContextFeedback | null,
): string | null {
	if (!feedback) return null;
	if (feedback.kind === "already_compacted") {
		return lang.t("Conversation context is already compacted");
	}
	return lang.t("Compacted {count} msg. (~{before} → ~{after} tok.)", {
		count: feedback.compactedCount,
		before: feedback.previousHistoryTokens,
		after: feedback.nextHistoryTokens,
	});
}
