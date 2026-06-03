import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import CharacterCard from "../CharacterCard";
import LocationCard from "../LocationCard";
import MonsterStatBlock from "../MonsterStatBlock";
import NoteCard from "../common/NoteCard";
import MonsterFieldEditModal from "../bestiary/MonsterFieldEditModal";
import Button from "../form/Button";
import EditableField from "../form/EditableField";
import Modal from "../common/Modal";
import classNames from "../../utils/classNames";
import { lang } from "../../services/localization";

function snapshotToText(value) {
	if (value === null || value === undefined) return "";
	return JSON.stringify(value, null, 2);
}

function parseSnapshotText(text, allowNull = false) {
	const trimmed = String(text || "").trim();
	if (!trimmed) {
		if (allowNull) return null;
		throw new Error(lang.t("Draft value cannot be empty."));
	}
	return JSON.parse(trimmed);
}

function isObjectSnapshot(value) {
	return value && typeof value === "object" && !Array.isArray(value);
}

function snapshotsEqual(before, after) {
	return JSON.stringify(before ?? null) === JSON.stringify(after ?? null);
}

function formatFieldValue(value) {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return JSON.stringify(value, null, 2);
}

function getPreviewFieldKeys(before, after, summary = []) {
	if (!isObjectSnapshot(before) || !isObjectSnapshot(after)) {
		return ["value"];
	}
	const ignoredKeys = new Set(["id", "slug", "source", "createdAt"]);
	const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
		.filter((key) => !ignoredKeys.has(key))
		.filter((key) => !snapshotsEqual(before[key], after[key]));
	return keys.length > 0 ? keys : summary;
}

function getFieldValue(snapshot, key) {
	if (key === "value") return snapshot;
	return isObjectSnapshot(snapshot) ? snapshot[key] : undefined;
}

function getChangedObjectKeys(before, after) {
	if (!isObjectSnapshot(before) || !isObjectSnapshot(after)) return [];
	const ignoredKeys = new Set([
		"id",
		"slug",
		"source",
		"createdAt",
		"collapsed",
		"isNotesCollapsed",
	]);
	return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
		(key) => !ignoredKeys.has(key) && !snapshotsEqual(before[key], after[key]),
	);
}

function getPreviewCardType(resource) {
	if (resource?.kind === "custom-monster") return "monster";
	if (resource?.kind === "entity") {
		if (resource.type === "characters" || resource.type === "npc") {
			return "character";
		}
		if (resource.type === "locations") return "location";
	}
	const id = String(resource?.id || "").toLowerCase();
	if (id.includes(":npcs/") || id.includes(":characters/")) return "character";
	if (id.includes(":locations/")) return "location";
	return null;
}

function getCardEntityType(resource) {
	if (resource?.type === "npc") return "npc";
	if (resource?.type === "characters") return "characters";
	const id = String(resource?.id || "").toLowerCase();
	if (id.includes(":npcs/")) return "npc";
	return "characters";
}

function isNoteSnapshot(value) {
	return (
		isObjectSnapshot(value) &&
		(Object.prototype.hasOwnProperty.call(value, "text") ||
			Object.prototype.hasOwnProperty.call(value, "title")) &&
		!Object.prototype.hasOwnProperty.call(value, "firstName") &&
		!Object.prototype.hasOwnProperty.call(value, "name")
	);
}

function isNoteResource(resource) {
	const id = String(resource?.id || "").toLowerCase();
	return (
		id.includes(":notes/") ||
		id.includes(":note/") ||
		isNoteSnapshot(resource?.before) ||
		isNoteSnapshot(resource?.after)
	);
}

function isEncounterResource(resource) {
	return (
		resource?.kind === "session" &&
		String(resource?.id || "")
			.toLowerCase()
			.includes(":encounters/")
	);
}

function getEncounterParticipants(snapshot) {
	return Array.isArray(snapshot?.monsters) ? snapshot.monsters : [];
}

function getEncounterParticipantName(participant = {}) {
	return String(
		participant.name ||
			participant.originalBestiaryName ||
			participant.title ||
			lang.t("Creature"),
	).trim();
}

function getEncounterParticipantBaseKey(participant = {}) {
	const type = String(participant.participantType || "monster")
		.trim()
		.toLowerCase();
	const id = String(participant.id || participant.instanceId || "").trim();
	if (id) return `${type}:id:${id}`;
	const source = String(participant.source || "")
		.trim()
		.toLowerCase();
	const name = getEncounterParticipantName(participant).toLowerCase();
	return `${type}:name:${name}:${source}`;
}

function getEncounterParticipantEntries(list) {
	const counts = new Map();
	return (Array.isArray(list) ? list : []).map((participant, index) => {
		const baseKey = getEncounterParticipantBaseKey(participant);
		const nextCount = (counts.get(baseKey) || 0) + 1;
		counts.set(baseKey, nextCount);
		return {
			key: `${baseKey}:${nextCount}`,
			index,
			participant,
		};
	});
}

function getEncounterParticipantHp(participant = {}) {
	if (participant.currentHp !== undefined && participant.currentHp !== null) {
		return participant.currentHp;
	}
	if (participant.hit_points !== undefined && participant.hit_points !== null) {
		return participant.hit_points;
	}
	if (participant.hp && typeof participant.hp === "object") {
		return participant.hp.average ?? participant.hp.special ?? "";
	}
	return "";
}

function getEncounterParticipantAc(participant = {}) {
	if (
		participant.armor_class !== undefined &&
		participant.armor_class !== null
	) {
		return participant.armor_class;
	}
	if (Array.isArray(participant.ac) && participant.ac.length > 0) {
		const first = participant.ac[0];
		return typeof first === "object" ? first.ac : first;
	}
	return "";
}

function getEncounterParticipantMeta(participant = {}) {
	return [
		participant.source ? String(participant.source).toUpperCase() : "",
		getEncounterParticipantAc(participant)
			? `AC ${getEncounterParticipantAc(participant)}`
			: "",
		getEncounterParticipantHp(participant)
			? `HP ${getEncounterParticipantHp(participant)}`
			: "",
		participant.cr || participant.challenge
			? `CR ${participant.cr || participant.challenge}`
			: "",
	]
		.filter(Boolean)
		.join(" / ");
}

const ENCOUNTER_PARTICIPANT_STAT_IGNORED_KEYS = new Set([
	"instanceId",
	"currentHp",
	"originalBestiaryName",
	"originalCharacterId",
	"originalCharacterSlug",
	"participantType",
]);

function getEncounterMonsterStatSnapshot(participant) {
	if (!isObjectSnapshot(participant)) return null;
	return Object.fromEntries(
		Object.entries(participant).filter(
			([key]) => !ENCOUNTER_PARTICIPANT_STAT_IGNORED_KEYS.has(key),
		),
	);
}

function encounterMonsterStatsChanged(before, after) {
	if (!before || !after) return false;
	return !snapshotsEqual(
		getEncounterMonsterStatSnapshot(before),
		getEncounterMonsterStatSnapshot(after),
	);
}

function getNoteDiffKey(note, index) {
	if (isObjectSnapshot(note)) {
		const id = String(note.id || "").trim();
		if (id) return `id:${id}`;
		const signature = `${String(note.title || "").trim()}\n${String(note.text || "").trim()}`;
		if (signature.trim()) return `content:${signature}`;
	}
	return `index:${index}`;
}

function buildNoteHighlightMap(beforeNotes, afterNotes) {
	const beforeList = Array.isArray(beforeNotes) ? beforeNotes : [];
	const afterList = Array.isArray(afterNotes) ? afterNotes : [];
	const beforeByKey = new Map(
		beforeList.map((note, index) => [getNoteDiffKey(note, index), note]),
	);
	const highlights = {};
	afterList.forEach((note, index) => {
		const before = beforeByKey.get(getNoteDiffKey(note, index));
		const changedFields = ["title", "text"].filter(
			(field) => !snapshotsEqual(before?.[field], note?.[field]),
		);
		if (changedFields.length === 0) return;
		const id = String(note?.id || "").trim();
		if (id) highlights[id] = changedFields;
		const title = String(note?.title || "").trim();
		if (title) highlights[title] = changedFields;
	});
	return highlights;
}

function buildCardHighlightFields(resource) {
	return {
		fields: getChangedObjectKeys(resource.before, resource.after).filter(
			(key) => key !== "notes",
		),
		notes: buildNoteHighlightMap(resource.before?.notes, resource.after?.notes),
	};
}

function cloneSnapshot(value) {
	return JSON.parse(JSON.stringify(value ?? null));
}

function hasOwn(object, key) {
	return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function buildNoteHighlightFields(resource) {
	return ["title", "text"].filter(
		(field) =>
			!snapshotsEqual(resource.before?.[field], resource.after?.[field]),
	);
}

function isResourceApplied(resource) {
	return resource?.applyState === "applied";
}

function isResourceUndone(resource) {
	return resource?.applyState === "undone";
}

export default function AiResponseModal({
	generatedPrompt,
	generatedPromptRef,
	isGeneratedPromptCopied,
	isRestoringResponse,
	markdownComponents,
	onApply,
	onApplyResource,
	onCancel,
	onCopy,
	onSaveDraftChanges,
	onUndo,
	onUndoResource,
	selectedResponseDetails,
	selectedResponseDiffResources,
	selectedResponseEntry,
	selectedResponseHasChanges,
	getDiffResourceState,
	getHistoryChangeSummary,
}) {
	const draftResources = useMemo(
		() =>
			selectedResponseEntry?.applyState === "draft" &&
			Array.isArray(selectedResponseEntry?.changes?.resources)
				? selectedResponseEntry.changes.resources
				: [],
		[selectedResponseEntry],
	);
	const [draftEdits, setDraftEdits] = useState({});
	const [draftResourceEdits, setDraftResourceEdits] = useState([]);
	const [draftError, setDraftError] = useState("");
	const [diffViewMode, setDiffViewMode] = useState("preview");
	const [fieldEditingCreature, setFieldEditingCreature] = useState(null);

	useEffect(() => {
		setDraftEdits(
			Object.fromEntries(
				draftResources.map((resource) => [
					resource.id,
					snapshotToText(resource.after),
				]),
			),
		);
		setDraftResourceEdits(JSON.parse(JSON.stringify(draftResources)));
		setDraftError("");
	}, [draftResources]);

	useEffect(() => {
		setDiffViewMode("preview");
	}, [selectedResponseEntry?.id]);

	if (!generatedPrompt) return null;

	const isDraft = selectedResponseEntry?.applyState === "draft";
	const noop = () => {};
	const getDraftResourceForPreview = (resource) => {
		if (!isDraft) return null;
		const parentResourceId = String(resource?.parentResourceId || "");
		return (
			draftResourceEdits.find((item) => item.id === resource.id) ||
			(parentResourceId
				? draftResourceEdits.find((item) => item.id === parentResourceId)
				: null) ||
			draftResourceEdits.find((item) =>
				String(resource.id || "").startsWith(`${item.id}:`),
			) ||
			null
		);
	};
	const findEditedListItem = (list, originalItem, index = null) =>
		(Array.isArray(list) ? list : []).find((item, itemIndex) => {
			if (Number.isInteger(index) && itemIndex === index) return true;
			const itemId = String(item?.id || "");
			const originalId = String(originalItem?.id || "");
			if (itemId && originalId) return itemId === originalId;
			const itemInstanceId = String(item?.instanceId || "");
			const originalInstanceId = String(originalItem?.instanceId || "");
			if (itemInstanceId && originalInstanceId) {
				return itemInstanceId === originalInstanceId;
			}
			return JSON.stringify(item) === JSON.stringify(originalItem);
		});
	const getEditedResourceAfterFromParent = (parentResource, resource) => {
		if (!parentResource || parentResource.id === resource.id) {
			return parentResource?.after;
		}
		const parentResourceId = String(
			resource.parentResourceId || parentResource.id || "",
		);
		if (
			!resource.parentResourceId &&
			!String(resource.id || "").startsWith(`${parentResource.id}:`)
		) {
			return undefined;
		}
		const suffix = String(resource.id).slice(parentResourceId.length + 1);
		const [section] = suffix.split("/");
		if (parentResource.kind === "session" && parentResource.after?.data) {
			if (
				["notes", "npcs", "locations", "scenes", "encounters"].includes(section)
			) {
				return findEditedListItem(
					parentResource.after.data[section],
					resource.after,
					resource.listIndex,
				);
			}
		}
		if (
			(parentResource.kind === "campaign" ||
				parentResource.kind === "entity") &&
			(suffix.startsWith("note:") || suffix.startsWith("notes/"))
		) {
			return findEditedListItem(
				parentResource.after?.notes,
				resource.after,
				resource.listIndex,
			);
		}
		if (
			parentResource.kind === "custom-bestiary" &&
			suffix.startsWith("monsters/")
		) {
			return findEditedListItem(
				parentResource.after,
				resource.after,
				resource.listIndex,
			);
		}
		return undefined;
	};
	const getEditedPreviewResource = (resource) => {
		const draftResource = getDraftResourceForPreview(resource);
		if (!draftResource) return resource;
		if (draftResource.id === resource.id) return draftResource;
		const editedAfter = getEditedResourceAfterFromParent(
			draftResource,
			resource,
		);
		return editedAfter === undefined
			? resource
			: { ...resource, after: editedAfter };
	};
	const replaceItemInList = (list, beforeItem, nextItem, index = null) =>
		(Array.isArray(list) ? list : []).map((item, itemIndex) => {
			if (Number.isInteger(index) && itemIndex === index) return nextItem;
			const itemId = String(item?.id || "");
			const beforeId = String(beforeItem?.id || "");
			if (itemId && beforeId && itemId === beforeId) return nextItem;
			const itemInstanceId = String(item?.instanceId || "");
			const beforeInstanceId = String(beforeItem?.instanceId || "");
			if (
				itemInstanceId &&
				beforeInstanceId &&
				itemInstanceId === beforeInstanceId
			) {
				return nextItem;
			}
			if (JSON.stringify(item) === JSON.stringify(beforeItem)) return nextItem;
			return item;
		});
	const updateDraftResourceAfter = (resource, nextSnapshot) => {
		if (!isDraft) return;
		setDraftResourceEdits((current) =>
			current.map((item) => {
				if (item.id === resource.id) return { ...item, after: nextSnapshot };
				const isParentResource = resource.parentResourceId
					? item.id === resource.parentResourceId
					: String(resource.id || "").startsWith(`${item.id}:`);
				if (!isParentResource) return item;
				const parentResourceId = String(resource.parentResourceId || item.id);
				const suffix = String(resource.id).slice(parentResourceId.length + 1);
				const nextAfter = JSON.parse(JSON.stringify(item.after ?? {}));
				if (item.kind === "session" && nextAfter.data) {
					const [section] = suffix.split("/");
					if (
						["notes", "npcs", "locations", "scenes", "encounters"].includes(
							section,
						)
					) {
						nextAfter.data[section] = replaceItemInList(
							nextAfter.data[section],
							resource.after,
							nextSnapshot,
							resource.listIndex,
						);
					}
				} else if (
					(item.kind === "campaign" || item.kind === "entity") &&
					(suffix.startsWith("note:") || suffix.startsWith("notes/"))
				) {
					nextAfter.notes = replaceItemInList(
						nextAfter.notes,
						resource.after,
						nextSnapshot,
						resource.listIndex,
					);
				} else if (
					item.kind === "custom-bestiary" &&
					suffix.startsWith("monsters/")
				) {
					return {
						...item,
						after: replaceItemInList(
							item.after,
							resource.after,
							nextSnapshot,
							resource.listIndex,
						),
					};
				}
				return { ...item, after: nextAfter };
			}),
		);
	};
	const getHistoryResourceId = (resource) => {
		const resources = Array.isArray(selectedResponseEntry?.changes?.resources)
			? selectedResponseEntry.changes.resources
			: [];
		return (
			resources.find((item) => item.id === resource.id)?.id ||
			resources.find((item) =>
				String(resource.id || "").startsWith(`${item.id}:`),
			)?.id ||
			resource.id
		);
	};
	const renderResourceActions = (resource) => {
		const applied = isResourceApplied(resource);
		const undone = isResourceUndone(resource);
		const canApply = isDraft && onApplyResource && !applied;
		const canUndo = onUndoResource && (applied || (isDraft && !undone));
		return (
			<>
				{applied && (
					<span className="AiAssistant__preview_resource_state is_applied">
						{lang.t("Applied")}
					</span>
				)}
				{undone && (
					<span className="AiAssistant__preview_resource_state is_undone">
						{lang.t("Undone")}
					</span>
				)}
				{canApply && (
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="check"
						onClick={() => handleApplyResource(resource)}
						disabled={isRestoringResponse}
						title={lang.t("Apply selected AI change")}
					>
						{lang.t("Apply")}
					</Button>
				)}
				{canUndo && (
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="undo"
						onClick={() => handleUndoResource(resource)}
						disabled={isRestoringResponse}
						title={lang.t("Undo selected AI change")}
					>
						{lang.t("Undo")}
					</Button>
				)}
			</>
		);
	};
	const preserveCreatureIdentity = (original, parsed) => {
		const next = { ...parsed };
		["id", "instanceId", "participantType"].forEach((key) => {
			if (!hasOwn(next, key) && original?.[key] !== undefined) {
				next[key] = original[key];
			}
		});
		return next;
	};
	const replaceEncounterParticipant = (
		encounter,
		participantKey,
		nextMonster,
	) => {
		const nextEncounter = cloneSnapshot(encounter || {});
		nextEncounter.monsters = getEncounterParticipantEntries(
			nextEncounter.monsters,
		).map((entry) =>
			entry.key === participantKey ? nextMonster : entry.participant,
		);
		return nextEncounter;
	};
	const openCreatureFieldEdit = (resource, monster, options = {}) => {
		if (!isDraft || isResourceApplied(resource) || !isObjectSnapshot(monster)) {
			return;
		}
		setFieldEditingCreature({ resource, monster, ...options });
	};
	const closeCreatureFieldEdit = () => {
		setFieldEditingCreature(null);
	};
	const saveCreatureFieldEdit = (draftMonster) => {
		if (!fieldEditingCreature?.resource || !isObjectSnapshot(draftMonster)) {
			return;
		}
		const nextMonster = preserveCreatureIdentity(
			fieldEditingCreature.monster,
			draftMonster,
		);
		if (fieldEditingCreature.mode === "encounter-participant") {
			const editedResource = getEditedPreviewResource(
				fieldEditingCreature.resource,
			);
			updateDraftResourceAfter(
				editedResource,
				replaceEncounterParticipant(
					editedResource.after,
					fieldEditingCreature.participantKey,
					nextMonster,
				),
			);
		} else {
			updateDraftResourceAfter(fieldEditingCreature.resource, nextMonster);
		}
		closeCreatureFieldEdit();
	};
	const renderNoteCard = (
		resource,
		note,
		editable = false,
		highlightFields = null,
	) => {
		if (!isObjectSnapshot(note)) return null;
		const campaignSlug =
			resource.campaign || selectedResponseEntry?.path?.campaign;
		const normalizedNote = {
			id: note.id || "preview-note",
			title: note.title || "",
			text: note.text || "",
			collapsed: Boolean(note.collapsed),
		};
		return (
			<NoteCard
				note={normalizedNote}
				isLast={false}
				campaignSlug={campaignSlug}
				onToggleCollapse={noop}
				onTitleChange={
					editable
						? (_id, title) =>
								updateDraftResourceAfter(resource, { ...note, title })
						: noop
				}
				onTextChange={
					editable
						? (_id, text) =>
								updateDraftResourceAfter(resource, { ...note, text })
						: noop
				}
				onDelete={noop}
				highlightFields={highlightFields}
			/>
		);
	};

	const renderEntityCard = (
		resource,
		snapshot,
		editable = false,
		highlightFields = null,
	) => {
		const cardType = getPreviewCardType(resource);
		if (!cardType || !isObjectSnapshot(snapshot)) return null;
		const campaignSlug =
			resource.campaign || selectedResponseEntry?.path?.campaign;
		if (cardType === "monster") {
			return (
				<MonsterStatBlock
					monster={snapshot}
					showFavoriteAction={false}
					allowTokenUpload={false}
					onFieldEdit={
						editable
							? (monster) => openCreatureFieldEdit(resource, monster)
							: null
					}
					searchHighlight=""
					highlightFields={highlightFields}
				/>
			);
		}
		if (cardType === "location") {
			return (
				<LocationCard
					location={snapshot}
					campaignSlug={campaignSlug}
					onChange={
						editable
							? (_id, next) => updateDraftResourceAfter(resource, next)
							: noop
					}
					onNameBlur={noop}
					onDelete={noop}
					onReorderDrop={noop}
					showDeleteButton={false}
					highlightFields={highlightFields}
				/>
			);
		}
		return (
			<CharacterCard
				character={snapshot}
				campaignSlug={campaignSlug}
				type={getCardEntityType(resource)}
				onChange={
					editable
						? (_id, next) => updateDraftResourceAfter(resource, next)
						: noop
				}
				onNameBlur={noop}
				onDelete={noop}
				onReorderDrop={noop}
				showDeleteButton={false}
				highlightFields={highlightFields}
			/>
		);
	};

	const renderEncounterParticipantList = (
		snapshot,
		counterpartSnapshot,
		side,
	) => {
		const entries = getEncounterParticipantEntries(
			getEncounterParticipants(snapshot),
		);
		const counterpartEntries = getEncounterParticipantEntries(
			getEncounterParticipants(counterpartSnapshot),
		);
		const counterpartByKey = new Map(
			counterpartEntries.map((entry) => [entry.key, entry.participant]),
		);

		if (entries.length === 0) {
			return (
				<div className="AiAssistant__encounter_empty">
					{lang.t("No creatures in encounter.")}
				</div>
			);
		}

		return (
			<ol className="AiAssistant__encounter_list">
				{entries.map(({ key, participant, index }) => {
					const counterpart = counterpartByKey.get(key);
					const isMissing = !counterpart;
					const isChanged =
						counterpart && !snapshotsEqual(participant, counterpart);
					return (
						<li
							key={`${side}-${key}-${index}`}
							className={classNames(
								"AiAssistant__encounter_item",
								side === "before" && isMissing && "is_removed",
								side === "after" && isMissing && "is_added",
								isChanged && "is_modified",
							)}
						>
							<span className="AiAssistant__encounter_item_name">
								{getEncounterParticipantName(participant)}
							</span>
							{getEncounterParticipantMeta(participant) && (
								<span className="AiAssistant__encounter_item_meta">
									{getEncounterParticipantMeta(participant)}
								</span>
							)}
						</li>
					);
				})}
			</ol>
		);
	};

	const renderEncounterMonsterCard = (
		participant,
		className,
		highlightFields = null,
		editOptions = null,
	) => {
		if (!isObjectSnapshot(participant)) return null;
		return (
			<div
				className={classNames(
					"AiAssistant__preview_card_surface",
					"AiAssistant__encounter_monster_surface",
					className,
				)}
			>
				<MonsterStatBlock
					monster={participant}
					showFavoriteAction={false}
					allowTokenUpload={false}
					onFieldEdit={
						editOptions
							? (monster) =>
									openCreatureFieldEdit(editOptions.resource, monster, {
										mode: "encounter-participant",
										participantKey: editOptions.participantKey,
									})
							: null
					}
					searchHighlight=""
					highlightFields={highlightFields}
				/>
			</div>
		);
	};

	const renderEncounterMonsterChanges = (resource) => {
		const beforeEntries = getEncounterParticipantEntries(
			getEncounterParticipants(resource.before),
		);
		const afterEntries = getEncounterParticipantEntries(
			getEncounterParticipants(resource.after),
		);
		const beforeByKey = new Map(
			beforeEntries.map((entry) => [entry.key, entry.participant]),
		);
		const afterByKey = new Map(
			afterEntries.map((entry) => [entry.key, entry.participant]),
		);
		const changedKeys = [
			...new Set([...beforeByKey.keys(), ...afterByKey.keys()]),
		].filter((key) => {
			const before = beforeByKey.get(key) || null;
			const after = afterByKey.get(key) || null;
			if (before?.participantType === "character") return false;
			if (after?.participantType === "character") return false;
			if (!before || !after) return true;
			return encounterMonsterStatsChanged(before, after);
		});

		if (changedKeys.length === 0) return null;

		return (
			<div className="AiAssistant__encounter_monsters">
				<div className="AiAssistant__preview_column_title">
					{lang.t("Creature changes")}
				</div>
				{changedKeys.map((key) => {
					const before = beforeByKey.get(key) || null;
					const after = afterByKey.get(key) || null;
					const label = getEncounterParticipantName(after || before);
					const highlightFields =
						before && after
							? buildCardHighlightFields({ before, after })
							: before
								? null
								: buildCardHighlightFields({ before: {}, after });

					if (!before || !after) {
						const editOptions =
							after && isDraft && !isResourceApplied(resource)
								? { resource, participantKey: key }
								: null;
						return (
							<div
								key={`${resource.id}-${key}`}
								className="AiAssistant__preview_card_stack"
							>
								<div className="AiAssistant__preview_card_frame">
									<div className="AiAssistant__preview_column_title">
										{label} / {before ? lang.t("Deleted") : lang.t("New")}
									</div>
									{renderEncounterMonsterCard(
										before || after,
										before ? "is_removed" : "is_added",
										highlightFields,
										editOptions,
									)}
								</div>
							</div>
						);
					}

					return (
						<div
							key={`${resource.id}-${key}`}
							className="AiAssistant__preview_card_columns"
						>
							<div className="AiAssistant__preview_card_frame">
								<div className="AiAssistant__preview_column_title">
									{label} / {lang.t("Before")}
								</div>
								{renderEncounterMonsterCard(
									before,
									"is_before",
									highlightFields,
								)}
							</div>
							<div className="AiAssistant__preview_card_frame">
								<div className="AiAssistant__preview_column_title">
									{label} / {lang.t("After")}
								</div>
								{renderEncounterMonsterCard(
									after,
									"is_after",
									highlightFields,
									isDraft && !isResourceApplied(resource)
										? { resource, participantKey: key }
										: null,
								)}
							</div>
						</div>
					);
				})}
			</div>
		);
	};

	const renderEncounterDiff = (resource) => {
		resource = getEditedPreviewResource(resource);
		const isNew = resource.before === null;
		const isDeleted = resource.after === null;
		const before = resource.before || null;
		const after = resource.after || null;
		const title = String(
			after?.name || before?.name || resource.label || "",
		).trim();

		return (
			<div
				key={resource.id}
				className={classNames(
					"AiAssistant__preview_resource",
					"AiAssistant__preview_resource_encounter",
					isNew && "is_added",
					isDeleted && "is_removed",
					isResourceApplied(resource) && "is_applied",
					isResourceUndone(resource) && "is_undone",
				)}
			>
				<div className="AiAssistant__preview_resource_header">
					<span>{title || resource.label}</span>
					<div className="AiAssistant__preview_resource_actions">
						<span>{getDiffResourceState(resource)}</span>
						{renderResourceActions(resource)}
					</div>
				</div>
				<div className="AiAssistant__preview_card_columns AiAssistant__encounter_columns">
					{!isNew && (
						<div className="AiAssistant__preview_card_frame">
							<div className="AiAssistant__preview_column_title">
								{lang.t("Before")}
							</div>
							<div className="AiAssistant__encounter_panel is_before">
								{renderEncounterParticipantList(before, after, "before")}
							</div>
						</div>
					)}
					{!isDeleted && (
						<div className="AiAssistant__preview_card_frame">
							<div className="AiAssistant__preview_column_title">
								{isNew ? lang.t("New") : lang.t("After")}
							</div>
							<div className="AiAssistant__encounter_panel is_after">
								{renderEncounterParticipantList(after, before, "after")}
							</div>
						</div>
					)}
				</div>
				{renderEncounterMonsterChanges(resource)}
			</div>
		);
	};

	const renderNoteCardDiff = (resource) => {
		resource = getEditedPreviewResource(resource);
		const isNew = resource.before === null;
		const isDeleted = resource.after === null;
		return (
			<div
				key={resource.id}
				className={classNames(
					"AiAssistant__preview_resource",
					"AiAssistant__preview_resource_notes",
					isNew && "is_added",
					isDeleted && "is_removed",
					isResourceApplied(resource) && "is_applied",
					isResourceUndone(resource) && "is_undone",
				)}
			>
				<div className="AiAssistant__preview_resource_header">
					<span>{resource.label}</span>
					<div className="AiAssistant__preview_resource_actions">
						<span>{getDiffResourceState(resource)}</span>
						{renderResourceActions(resource)}
					</div>
				</div>
				{isNew || isDeleted ? (
					<div className="AiAssistant__preview_card_stack">
						<div className="AiAssistant__preview_card_frame">
							<div className="AiAssistant__preview_column_title">
								{isNew ? lang.t("New") : lang.t("Deleted")}
							</div>
							<div
								className={classNames(
									"AiAssistant__preview_note_surface",
									isDraft && isNew && "is_editable",
								)}
							>
								{renderNoteCard(
									resource,
									isNew ? resource.after : resource.before,
									isDraft && isNew && !isResourceApplied(resource),
									isNew ? ["title", "text"] : null,
								)}
							</div>
						</div>
					</div>
				) : (
					<div className="AiAssistant__preview_card_columns">
						<div className="AiAssistant__preview_card_frame">
							<div className="AiAssistant__preview_column_title">
								{lang.t("Before")}
							</div>
							<div className="AiAssistant__preview_note_surface is_before">
								{renderNoteCard(
									resource,
									resource.before,
									false,
									buildNoteHighlightFields(resource),
								)}
							</div>
						</div>
						<div className="AiAssistant__preview_card_frame">
							<div className="AiAssistant__preview_column_title">
								{lang.t("After")}
							</div>
							<div
								className={classNames(
									"AiAssistant__preview_note_surface is_after",
									isDraft && "is_editable",
								)}
							>
								{renderNoteCard(
									resource,
									resource.after,
									isDraft && !isResourceApplied(resource),
									buildNoteHighlightFields(resource),
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		);
	};

	const renderNoteArrayDiff = (resource, beforeNotes, afterNotes) => {
		const beforeList = Array.isArray(beforeNotes) ? beforeNotes : [];
		const afterList = Array.isArray(afterNotes) ? afterNotes : [];
		const beforeByKey = new Map(
			beforeList.map((note, index) => [getNoteDiffKey(note, index), note]),
		);
		const afterByKey = new Map(
			afterList.map((note, index) => [getNoteDiffKey(note, index), note]),
		);
		const keys = [
			...new Set([...beforeByKey.keys(), ...afterByKey.keys()]),
		].filter(
			(key) => !snapshotsEqual(beforeByKey.get(key), afterByKey.get(key)),
		);
		return (
			<div className="AiAssistant__preview_note_list">
				{keys.map((key, index) => {
					const before = beforeByKey.get(key) ?? null;
					const after = afterByKey.get(key) ?? null;
					const listIndex = afterList.findIndex(
						(note, noteIndex) => getNoteDiffKey(note, noteIndex) === key,
					);
					return renderNoteCardDiff({
						...resource,
						parentResourceId: resource.id,
						id: `${resource.id}:note:${key}`,
						label: `${resource.label} / ${lang.t("Note")} ${index + 1}`,
						before,
						after,
						listIndex: listIndex >= 0 ? listIndex : null,
					});
				})}
			</div>
		);
	};

	const renderPreviewResource = (resource) => {
		resource = getEditedPreviewResource(resource);
		const isNew = resource.before === null;
		const isDeleted = resource.after === null;
		const cardType = getPreviewCardType(resource);
		const fieldKeys = getPreviewFieldKeys(
			resource.before,
			resource.after,
			resource.fieldSummary,
		);

		if (isEncounterResource(resource)) {
			return renderEncounterDiff(resource);
		}

		if (isNoteResource(resource)) {
			return renderNoteCardDiff(resource);
		}

		if (cardType) {
			return (
				<div
					key={resource.id}
					className={classNames(
						"AiAssistant__preview_resource",
						"AiAssistant__preview_resource_cards",
						isNew && "is_added",
						isDeleted && "is_removed",
						isResourceApplied(resource) && "is_applied",
						isResourceUndone(resource) && "is_undone",
					)}
				>
					<div className="AiAssistant__preview_resource_header">
						<span>{resource.label}</span>
						<div className="AiAssistant__preview_resource_actions">
							<span>{getDiffResourceState(resource)}</span>
							{renderResourceActions(resource)}
						</div>
					</div>
					{isNew || isDeleted ? (
						<div className="AiAssistant__preview_card_stack">
							<div className="AiAssistant__preview_card_frame">
								<div className="AiAssistant__preview_column_title">
									{isNew ? lang.t("New") : lang.t("Deleted")}
								</div>
								<div
									className={classNames(
										"AiAssistant__preview_card_surface",
										isDraft && isNew && "is_editable",
									)}
								>
									{renderEntityCard(
										resource,
										isNew ? resource.after : resource.before,
										isDraft && isNew && !isResourceApplied(resource),
										isNew
											? buildCardHighlightFields({
													before: {},
													after: resource.after,
												})
											: null,
									)}
								</div>
							</div>
						</div>
					) : (
						<div className="AiAssistant__preview_card_columns">
							<div className="AiAssistant__preview_card_frame">
								<div className="AiAssistant__preview_column_title">
									{lang.t("Before")}
								</div>
								<div className="AiAssistant__preview_card_surface is_before">
									{renderEntityCard(
										resource,
										resource.before,
										false,
										buildCardHighlightFields(resource),
									)}
								</div>
							</div>
							<div className="AiAssistant__preview_card_frame">
								<div className="AiAssistant__preview_column_title">
									{lang.t("After")}
								</div>
								<div
									className={classNames(
										"AiAssistant__preview_card_surface is_after",
										isDraft && "is_editable",
									)}
								>
									{renderEntityCard(
										resource,
										resource.after,
										isDraft && !isResourceApplied(resource),
										buildCardHighlightFields(resource),
									)}
								</div>
							</div>
						</div>
					)}
				</div>
			);
		}

		if (isNew || isDeleted) {
			const snapshot = isNew ? resource.after : resource.before;
			const keys = isObjectSnapshot(snapshot)
				? Object.keys(snapshot).filter(
						(key) => !["id", "slug", "source", "createdAt"].includes(key),
					)
				: ["value"];
			return (
				<div
					key={resource.id}
					className={classNames(
						"AiAssistant__preview_resource",
						isNew ? "is_added" : "is_removed",
						isResourceApplied(resource) && "is_applied",
						isResourceUndone(resource) && "is_undone",
					)}
				>
					<div className="AiAssistant__preview_resource_header">
						<span>{resource.label}</span>
						<div className="AiAssistant__preview_resource_actions">
							<span>{getDiffResourceState(resource)}</span>
							{renderResourceActions(resource)}
						</div>
					</div>
					<div className="AiAssistant__preview_stack">
						{keys.map((key) => (
							<div
								key={`${resource.id}-${key}`}
								className="AiAssistant__preview_field"
							>
								<div className="AiAssistant__preview_field_label">{key}</div>
								<pre>{formatFieldValue(getFieldValue(snapshot, key))}</pre>
							</div>
						))}
					</div>
				</div>
			);
		}

		return (
			<div
				key={resource.id}
				className={classNames(
					"AiAssistant__preview_resource",
					isResourceApplied(resource) && "is_applied",
					isResourceUndone(resource) && "is_undone",
				)}
			>
				<div className="AiAssistant__preview_resource_header">
					<span>{resource.label}</span>
					<div className="AiAssistant__preview_resource_actions">
						<span>{getDiffResourceState(resource)}</span>
						{renderResourceActions(resource)}
					</div>
				</div>
				{fieldKeys.map((key) => (
					<div
						key={`${resource.id}-${key}`}
						className="AiAssistant__preview_field"
					>
						<div className="AiAssistant__preview_field_label">{key}</div>
						{key === "notes" &&
						(Array.isArray(getFieldValue(resource.before, key)) ||
							Array.isArray(getFieldValue(resource.after, key))) ? (
							renderNoteArrayDiff(
								resource,
								getFieldValue(resource.before, key),
								getFieldValue(resource.after, key),
							)
						) : (
							<div className="AiAssistant__preview_columns">
								<div className="AiAssistant__preview_column">
									<div className="AiAssistant__preview_column_title">
										{lang.t("Before")}
									</div>
									<pre className="is_removed">
										{formatFieldValue(getFieldValue(resource.before, key))}
									</pre>
								</div>
								<div className="AiAssistant__preview_column">
									<div className="AiAssistant__preview_column_title">
										{lang.t("After")}
									</div>
									<pre className="is_added">
										{formatFieldValue(getFieldValue(resource.after, key))}
									</pre>
								</div>
							</div>
						)}
					</div>
				))}
			</div>
		);
	};

	const renderJsonDiff = () =>
		selectedResponseDiffResources.map((resource) => (
			<div key={resource.id} className="AiAssistant__diff_file">
				<div className="AiAssistant__diff_file_header">
					<span>{resource.label}</span>
					<span>{getDiffResourceState(resource)}</span>
				</div>
				{resource.fieldSummary.length > 0 && (
					<div className="AiAssistant__diff_field_summary">
						<span>{lang.t("Changed fields")}:</span>
						{resource.fieldSummary.map((field) => (
							<code key={`${resource.id}-${field}`}>{field}</code>
						))}
					</div>
				)}
				<div className="AiAssistant__diff_lines">
					{resource.lines.map((line, index) => (
						<div
							key={`${resource.id}-${index}`}
							className={classNames(
								"AiAssistant__diff_line",
								`is_${line.type}`,
							)}
						>
							<span className="AiAssistant__diff_line_number">
								{line.oldNumber || ""}
							</span>
							<span className="AiAssistant__diff_line_number">
								{line.newNumber || ""}
							</span>
							<span className="AiAssistant__diff_line_marker">
								{line.type === "added"
									? "+"
									: line.type === "removed"
										? "-"
										: " "}
							</span>
							<code>{line.text || " "}</code>
						</div>
					))}
				</div>
			</div>
		));

	const handleApply = async () => {
		if (!isDraft || draftResources.length === 0 || !onSaveDraftChanges) {
			onApply(selectedResponseEntry);
			return;
		}
		try {
			const resources = draftResourceEdits.map((resource) => ({
				id: resource.id,
				after: resource.after,
			}));
			setDraftError("");
			const updatedEntry = await onSaveDraftChanges(resources);
			onApply(updatedEntry || selectedResponseEntry);
		} catch (error) {
			setDraftError(error.message || lang.t("Invalid draft changes"));
		}
	};

	const handleApplyResource = async (resource) => {
		if (!isDraft || !onSaveDraftChanges || !onApplyResource) return;
		try {
			const resources = draftResourceEdits.map((entry) => ({
				id: entry.id,
				after: entry.after,
			}));
			setDraftError("");
			const updatedEntry = await onSaveDraftChanges(resources);
			onApplyResource(updatedEntry || selectedResponseEntry, [
				getHistoryResourceId(resource),
			]);
		} catch (error) {
			setDraftError(error.message || lang.t("Invalid draft changes"));
		}
	};

	const handleUndoResource = (resource) => {
		if (!onUndoResource) return;
		onUndoResource(selectedResponseEntry, [getHistoryResourceId(resource)]);
	};

	return (
		<>
			<Modal
				title={lang.t("Response")}
				onCancel={onCancel}
				showFooter={false}
				overlayClassName={classNames(
					"AiAssistant__response_overlay",
					selectedResponseHasChanges && "AiAssistant__response_overlay_wide",
				)}
				cancelDisabled={isRestoringResponse}
			>
				<div className="AiAssistant__prompt_result_wrap">
					<div className="AiAssistant__prompt_result_actions">
						{selectedResponseHasChanges && (
							<>
								{!isDraft && (
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="undo"
										onClick={onUndo}
										disabled={isRestoringResponse}
										title={lang.t("Undo AI changes")}
									>
										{lang.t("Undo")}
									</Button>
								)}
								<Button
									variant="primary"
									size={Button.SIZES.SMALL}
									icon="check"
									onClick={handleApply}
									disabled={isRestoringResponse}
									title={lang.t("Apply AI changes")}
								>
									{lang.t("Apply")}
								</Button>
							</>
						)}
						{!selectedResponseHasChanges && (
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon={isGeneratedPromptCopied ? "check" : "copy"}
								onClick={onCopy}
								title={lang.t("Copy formatted text for Word")}
							/>
						)}
					</div>
					{!selectedResponseHasChanges && (
						<div
							className="AiAssistant__prompt_result"
							ref={generatedPromptRef}
						>
							<ReactMarkdown components={markdownComponents}>
								{generatedPrompt}
							</ReactMarkdown>
						</div>
					)}
					{selectedResponseDetails.length > 0 && (
						<div className="AiAssistant__response_details">
							<div className="AiAssistant__response_details_title">
								{lang.t("Request details")}
							</div>
							{selectedResponseDetails.map((row) => (
								<div
									key={row.label}
									className="AiAssistant__response_details_row"
								>
									<span className="AiAssistant__response_details_label">
										{row.label}
									</span>
									<span className="AiAssistant__response_details_value">
										{row.value}
									</span>
								</div>
							))}
						</div>
					)}
					{selectedResponseHasChanges && (
						<div className="AiAssistant__diff">
							<div className="AiAssistant__diff_title">
								<span>{lang.t("Changes")}</span>
								<span>{getHistoryChangeSummary(selectedResponseEntry)}</span>
							</div>
							{isDraft && (
								<div className="AiAssistant__diff_hint">
									{lang.t(
										"You can enable automatic applying of parsed AI changes in settings.",
									)}
								</div>
							)}
							<div className="AiAssistant__diff_view_switch">
								<Button
									variant={diffViewMode === "preview" ? "primary" : "ghost"}
									size={Button.SIZES.SMALL}
									onClick={() => setDiffViewMode("preview")}
								>
									{lang.t("Preview")}
								</Button>
								<Button
									variant={diffViewMode === "json" ? "primary" : "ghost"}
									size={Button.SIZES.SMALL}
									onClick={() => setDiffViewMode("json")}
								>
									JSON
								</Button>
							</div>
							{diffViewMode === "preview" ? (
								<div className="AiAssistant__preview_diff">
									{selectedResponseDiffResources.map(renderPreviewResource)}
								</div>
							) : (
								renderJsonDiff()
							)}
							{isDraft && draftResources.length > 0 && draftError && (
								<div className="AiAssistant__draft_error">{draftError}</div>
							)}
							{isDraft &&
								draftResources.length > 0 &&
								diffViewMode === "json" && (
									<div className="AiAssistant__draft_editor">
										<div className="AiAssistant__draft_editor_title">
											{lang.t("Draft values before applying")}
										</div>
										{draftResources.map((resource) => {
											const isNew = resource.before === null;
											return (
												<div
													key={resource.id}
													className={classNames(
														"AiAssistant__draft_resource",
														isNew && "is_new",
													)}
												>
													<div className="AiAssistant__draft_resource_header">
														<span>{resource.label}</span>
														<div className="AiAssistant__preview_resource_actions">
															<span>{getDiffResourceState(resource)}</span>
															{renderResourceActions(resource)}
														</div>
													</div>
													<div className="AiAssistant__draft_columns">
														{!isNew && (
															<div className="AiAssistant__draft_column">
																<div className="AiAssistant__draft_column_title">
																	{lang.t("Before")}
																</div>
																<pre>{snapshotToText(resource.before)}</pre>
															</div>
														)}
														<div className="AiAssistant__draft_column">
															<div className="AiAssistant__draft_column_title">
																{isNew ? lang.t("New") : lang.t("After")}
															</div>
															<EditableField
																type="textarea"
																className="AiAssistant__draft_textarea"
																value={draftEdits[resource.id] || ""}
																onChange={(event) => {
																	const text = event.target.value;
																	setDraftEdits((current) => ({
																		...current,
																		[resource.id]: text,
																	}));
																	try {
																		const after = parseSnapshotText(
																			text,
																			resource.after === null,
																		);
																		setDraftResourceEdits((current) =>
																			current.map((item) =>
																				item.id === resource.id
																					? { ...item, after }
																					: item,
																			),
																		);
																		setDraftError("");
																	} catch {
																		setDraftError(
																			lang.t("Invalid draft changes"),
																		);
																	}
																}}
															/>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								)}
						</div>
					)}
				</div>
			</Modal>
			<MonsterFieldEditModal
				editingMonster={fieldEditingCreature?.monster || null}
				onCancel={closeCreatureFieldEdit}
				onSave={saveCreatureFieldEdit}
			/>
		</>
	);
}
