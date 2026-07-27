const crypto = require("crypto");
const {
	coerceAiText: asText,
	sanitizeAiName: sanitizeEntityName,
} = require("../../ai/textUtils");
const { parseNameParts } = require("./entityOperationUtils");
const { normalizeNote } = require("./notePatchService");

function createAiContentNormalizer({
	createId = () => crypto.randomUUID(),
	normalizeNoteValue = normalizeNote,
	text = asText,
	sanitizeName = sanitizeEntityName,
} = {}) {
	function hasOwn(value, key) {
		return Boolean(
			value &&
				typeof value === "object" &&
				Object.prototype.hasOwnProperty.call(value, key),
		);
	}

	function firstOwnedValue(value, keys) {
		for (const key of keys) {
			if (hasOwn(value, key)) return value[key];
		}
		return undefined;
	}

	function normalizeLevel(rawLevel) {
		if (typeof rawLevel === "string" && rawLevel.trim() === "") return "";
		const parsed = Number.parseInt(String(rawLevel ?? "1"), 10);
		if (!Number.isFinite(parsed)) return 1;
		if (parsed < 1) return 1;
		if (parsed > 20) return 20;
		return parsed;
	}

	function normalizeNotes(
		notes,
		{ keepAtLeastOne = false, simplifiedNotes = false } = {},
	) {
		const list = Array.isArray(notes) ? notes : [];
		const normalized = list
			.map((note) =>
				normalizeNoteValue(note, { simplifiedNotes }),
			)
			.filter(
				(note) =>
					note &&
					(String(note.title || "").trim() ||
						String(note.text || "").trim()),
			);
		if (keepAtLeastOne && normalized.length === 0) {
			normalized.push({
				id: createId(),
				title: "",
				text: "",
				collapsed: false,
			});
		}
		return normalized;
	}

	function noteSignature(note = {}) {
		if (typeof note === "string") {
			return JSON.stringify({ title: "", text: note });
		}
		return JSON.stringify({
			title: text(note.title),
			text: text(note.text),
		});
	}

	function isAiIgnored(value = {}) {
		return Boolean(value?._aiIgnored);
	}

	function normalizeNotesPreservingExisting(
		notes,
		existingNotes = [],
		{ keepAtLeastOne = false, simplifiedNotes = false } = {},
	) {
		const normalized = normalizeNotes(notes, {
			keepAtLeastOne,
			simplifiedNotes,
		});
		const existingById = new Map(
			(existingNotes || [])
				.map((note) => [text(note?.id), note])
				.filter(([id]) => Boolean(id)),
		);
		const existingByContent = new Map(
			(existingNotes || [])
				.map((note) => [noteSignature(note), note])
				.filter(([signature]) => signature !== noteSignature()),
		);

		return normalized.map((note) => {
			const existing =
				existingById.get(text(note.id)) ||
				existingByContent.get(noteSignature(note));
			if (!existing) return note;
			return {
				...note,
				id: existing.id,
				collapsed: Boolean(existing.collapsed),
			};
		});
	}

	function mergeAiIgnoredNotes(existingNotes = [], visibleNotes = []) {
		const existing = Array.isArray(existingNotes) ? existingNotes : [];
		if (!existing.some(isAiIgnored)) return visibleNotes;
		const ignoredNotes = existing.filter(isAiIgnored);
		const ignoredIds = new Set(
			ignoredNotes.map((note) => text(note?.id)).filter(Boolean),
		);
		const result = (
			Array.isArray(visibleNotes) ? visibleNotes : []
		).filter((note) => {
			const id = text(note?.id);
			return !id || !ignoredIds.has(id);
		});
		const visibleIndexById = () =>
			new Map(
				result
					.map((note, index) => [text(note?.id), index])
					.filter(([id]) => Boolean(id)),
			);

		for (const ignoredNote of ignoredNotes) {
			const originalIndex = existing.indexOf(ignoredNote);
			const previousVisible = [...existing.slice(0, originalIndex)]
				.reverse()
				.find((note) => !isAiIgnored(note) && text(note?.id));
			const nextVisible = existing
				.slice(originalIndex + 1)
				.find((note) => !isAiIgnored(note) && text(note?.id));
			const indexes = visibleIndexById();
			const previousIndex = indexes.get(text(previousVisible?.id));
			const nextIndex = indexes.get(text(nextVisible?.id));

			if (previousIndex !== undefined) {
				result.splice(previousIndex + 1, 0, ignoredNote);
			} else if (nextIndex !== undefined) {
				result.splice(nextIndex, 0, ignoredNote);
			} else {
				result.splice(
					Math.min(originalIndex, result.length),
					0,
					ignoredNote,
				);
			}
		}

		return result;
	}

	function normalizeCharacter(
		raw,
		existing = null,
		{ simplifiedNotes = false } = {},
	) {
		const nameParts = parseNameParts(raw);
		const rawHasName = [
			"name",
			"fullName",
			"title",
			"firstName",
			"first_name",
			"lastName",
			"last_name",
		].some((key) => hasOwn(raw, key));
		const notesSource = Array.isArray(raw.notes)
			? raw.notes
			: existing
				? existing.notes || []
				: [];
		const rawRace = firstOwnedValue(raw, ["race", "species"]);
		const rawClass = firstOwnedValue(raw, ["class", "role"]);
		const rawMotivation = firstOwnedValue(raw, ["motivation", "goal"]);
		const rawDescription = firstOwnedValue(raw, [
			"description",
			"bio",
			"backstory",
		]);
		const rawTrait = firstOwnedValue(raw, [
			"trait",
			"personality",
			"quirk",
		]);
		const notes = normalizeNotesPreservingExisting(
			notesSource,
			existing?.notes || [],
			{ keepAtLeastOne: true, simplifiedNotes },
		);

		return {
			id: existing?.id || createId(),
			firstName: rawHasName
				? nameParts.firstName
				: existing?.firstName || "",
			lastName: rawHasName
				? nameParts.lastName
				: existing?.lastName || "",
			race:
				rawRace !== undefined ? text(rawRace) : existing?.race || "",
			class:
				rawClass !== undefined ? text(rawClass) : existing?.class || "",
			level: hasOwn(raw, "level")
				? normalizeLevel(raw.level)
				: normalizeLevel(existing?.level),
			motivation:
				rawMotivation !== undefined
					? text(rawMotivation)
					: existing?.motivation || "",
			description:
				rawDescription !== undefined
					? text(rawDescription)
					: existing?.description || "",
			trait:
				rawTrait !== undefined
					? text(rawTrait)
					: existing?.trait || "",
			notes: mergeAiIgnoredNotes(existing?.notes || [], notes),
			collapsed: Boolean(
				existing?.collapsed ?? raw.collapsed ?? false,
			),
			isNotesCollapsed: Boolean(
				existing?.isNotesCollapsed ??
					raw.isNotesCollapsed ??
					false,
			),
			imageUrl: existing?.imageUrl ?? raw.imageUrl ?? null,
		};
	}

	function normalizeLocation(
		raw,
		existing = null,
		{ simplifiedNotes = false } = {},
	) {
		const rawName = firstOwnedValue(raw, ["name", "title"]);
		const rawDescription = firstOwnedValue(raw, [
			"description",
			"summary",
			"text",
		]);
		const notesSource = Array.isArray(raw.notes)
			? raw.notes
			: existing
				? existing.notes || []
				: [];
		const notes = normalizeNotesPreservingExisting(
			notesSource,
			existing?.notes || [],
			{ keepAtLeastOne: true, simplifiedNotes },
		);

		return {
			id: existing?.id || createId(),
			name:
				rawName !== undefined
					? sanitizeName(rawName)
					: existing?.name || "",
			description:
				rawDescription !== undefined
					? text(rawDescription)
					: existing?.description || "",
			notes: mergeAiIgnoredNotes(existing?.notes || [], notes),
			collapsed: Boolean(
				existing?.collapsed ?? raw.collapsed ?? false,
			),
			isNotesCollapsed: Boolean(
				existing?.isNotesCollapsed ??
					raw.isNotesCollapsed ??
					false,
			),
			imageUrl: existing?.imageUrl ?? raw.imageUrl ?? null,
		};
	}

	return {
		mergeAiIgnoredNotes,
		normalizeCharacter,
		normalizeLocation,
		normalizeNotesPreservingExisting,
	};
}

const {
	mergeAiIgnoredNotes,
	normalizeCharacter,
	normalizeLocation,
	normalizeNotesPreservingExisting,
} = createAiContentNormalizer();

module.exports = {
	createAiContentNormalizer,
	mergeAiIgnoredNotes,
	normalizeCharacter,
	normalizeLocation,
	normalizeNotesPreservingExisting,
};
