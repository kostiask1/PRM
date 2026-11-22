const LEGACY_ARCHIVE_CHAT_ID = "chat-legacy-archive";
const LEGACY_ARCHIVE_CHAT_TITLE = "Архів старого асистента";

function asTrimmedText(value) {
	return String(value ?? "").trim();
}

function parseTimestampMs(rawDate, fallback) {
	const parsed = Date.parse(String(rawDate || ""));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function extractLegacyAssistantError(entry) {
	if (!entry || entry.status !== "failed") return "";
	if (typeof entry.error === "string") return entry.error.trim();
	if (entry.error && typeof entry.error === "object") {
		return asTrimmedText(entry.error.message || entry.error.error || entry.text);
	}
	return asTrimmedText(entry.text);
}

function isMigratableLegacyEntry(entry) {
	if (!entry || typeof entry !== "object") return false;
	if (entry.type === "chat-action") return false;
	if (entry.status === "pending") return false;
	return Boolean(
		asTrimmedText(entry.userInstructions) ||
			asTrimmedText(entry.text) ||
			asTrimmedText(entry.imageUrl) ||
			extractLegacyAssistantError(entry),
	);
}

/**
 * Performs an idempotent, non-destructive one-time import of legacy _aiResponses entries
 * into a dedicated archived AI Chat V2 conversation while keeping _aiResponses intact for Undo.
 */
function createLegacyAiHistoryChatMigration({ storage, chatRepository }) {
	const inFlightBySlug = new Map();

	async function runMigration(campaignSlug) {
		const slug = asTrimmedText(campaignSlug);
		if (!slug) return { migrated: false, importedCount: 0 };

		const alreadyMigrated = await chatRepository.hasLegacyHistoryMigrated(slug);
		if (alreadyMigrated) {
			return { migrated: false, importedCount: 0 };
		}

		const rawEntries = await storage.readAiResponses(slug).catch(() => []);
		const eligible = (Array.isArray(rawEntries) ? rawEntries : [])
			.filter(isMigratableLegacyEntry)
			.slice()
			.sort((left, right) => parseTimestampMs(left.createdAt, 0) - parseTimestampMs(right.createdAt, 0));

		if (eligible.length === 0) {
			return { migrated: false, importedCount: 0 };
		}

		const now = Date.now();
		const messages = [];
		let lastModelName = "";

		eligible.forEach((entry, idx) => {
			const createdMs = parseTimestampMs(entry.createdAt, now + idx * 10);
			const entryId = asTrimmedText(entry.id) || String(idx + 1);
			const userText = asTrimmedText(entry.userInstructions);
			const typeLabel = asTrimmedText(entry.type) || "AI";
			const assistantText = asTrimmedText(entry.text);
			const imageUrl = asTrimmedText(entry.imageUrl);
			const errorText = extractLegacyAssistantError(entry);
			if (asTrimmedText(entry.modelName)) {
				lastModelName = asTrimmedText(entry.modelName);
			}

			messages.push({
				id: `legacy-u-${entryId}`,
				role: "user",
				content: userText || `[Запит: ${typeLabel}]`,
				timestamp: createdMs,
				status: "done",
			});

			messages.push({
				id: `legacy-a-${entryId}`,
				role: "assistant",
				content: assistantText || (errorText ? `Помилка: ${errorText}` : imageUrl ? "Згенероване зображення" : ""),
				...(imageUrl ? { imageUrl } : {}),
				timestamp: createdMs + 1,
				status: entry.status === "failed" ? "error" : "done",
				...(entry.status === "failed" && errorText ? { errorMessage: errorText } : {}),
			});
		});

		const firstTimestamp = messages[0]?.timestamp || now;
		const lastTimestamp = messages[messages.length - 1]?.timestamp || now;
		const archiveChat = {
			id: LEGACY_ARCHIVE_CHAT_ID,
			title: LEGACY_ARCHIVE_CHAT_TITLE,
			isAutoTitled: true,
			isLegacyArchive: true,
			createdAt: firstTimestamp,
			updatedAt: lastTimestamp,
			model: lastModelName,
			autoApply: false,
			messages,
		};

		await chatRepository.markLegacyHistoryMigrated(slug, archiveChat);
		return { migrated: true, importedCount: eligible.length };
	}

	async function ensureMigrated(campaignSlug) {
		const key = asTrimmedText(campaignSlug);
		if (!key) return { migrated: false, importedCount: 0 };
		if (inFlightBySlug.has(key)) {
			return inFlightBySlug.get(key);
		}
		const promise = runMigration(key).finally(() => {
			if (inFlightBySlug.get(key) === promise) {
				inFlightBySlug.delete(key);
			}
		});
		inFlightBySlug.set(key, promise);
		return promise;
	}

	return { ensureMigrated };
}

module.exports = {
	LEGACY_ARCHIVE_CHAT_ID,
	LEGACY_ARCHIVE_CHAT_TITLE,
	createLegacyAiHistoryChatMigration,
};
