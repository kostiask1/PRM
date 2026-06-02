const IGNORED_TEXT_KEYS = new Set([
	"id",
	"slug",
	"fileName",
	"imageUrl",
	"imageAlt",
	"createdAt",
	"completedAt",
	"order",
	"collapsed",
	"isNotesCollapsed",
	"isDescriptionCollapsed",
	"isCharactersCollapsed",
	"isNpcsCollapsed",
	"isLocationsCollapsed",
	"completed",
]);

const TYPE_PRIORITY = [
	"character",
	"npc",
	"location",
	"session",
	"campaign-note",
	"session-note",
	"scene",
	"scene-note",
	"campaign",
];

export function normalizeGraphName(value) {
	return String(value || "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();
}

export function extractBracketMentions(text) {
	if (typeof text !== "string" || !text.includes("[")) return [];

	const mentions = [];
	const regex = /\[([^[\]\r\n]+)\]/g;
	let match;
	while ((match = regex.exec(text)) !== null) {
		const name = String(match[1] || "")
			.trim()
			.replace(/\s+/g, " ");
		if (name) mentions.push(name);
	}
	return mentions;
}

function isEmptyNote(note = {}) {
	return (
		String(note.title || "").trim().length === 0 &&
		String(note.text || "").trim().length === 0
	);
}

function stripMarkdownForGraphText(value) {
	return String(value || "")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.split(/\r?\n/)
		.map((line) =>
			line
				.replace(/^\s{0,3}#{1,6}\s+/g, "")
				.replace(/^\s{0,3}>\s?/g, "")
				.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/g, "")
				.replace(/^\s*[-*+]\s+/g, "")
				.replace(/^\s*\d+[.)]\s+/g, "")
				.replace(/^\s*[-*_]{3,}\s*$/g, "")
				.replace(/[*_~]+/g, "")
				.trim(),
		)
		.filter(Boolean)
		.join(" ");
}

function excerpt(value, maxLength = 160, { stripMarkdown = false } = {}) {
	const text = String(value || "")
		.replace(/\s+/g, " ")
		.trim();
	const normalizedText = (
		stripMarkdown ? stripMarkdownForGraphText(text) : text
	)
		.replace(/\s+/g, " ")
		.trim();
	if (normalizedText.length <= maxLength) return normalizedText;
	return `${normalizedText.slice(0, maxLength - 1).trim()}...`;
}

function collectStrings(value, path = "", output = []) {
	if (value === null || value === undefined) return output;

	if (typeof value === "string") {
		if (value.trim()) output.push({ value, field: path || "text" });
		return output;
	}

	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			collectStrings(item, `${path}[${index}]`, output);
		});
		return output;
	}

	if (typeof value === "object") {
		Object.entries(value).forEach(([key, item]) => {
			if (key.startsWith("_") || IGNORED_TEXT_KEYS.has(key)) return;
			collectStrings(item, path ? `${path}.${key}` : key, output);
		});
	}

	return output;
}

function getMentionsFromValue(value, sourceField) {
	return collectStrings(value, sourceField).flatMap(({ value: text, field }) =>
		extractBracketMentions(text).map((name) => ({ name, field })),
	);
}

function getCharacterLabel(entity = {}, fallback) {
	return (
		`${entity.firstName || ""} ${entity.lastName || ""}`.trim() ||
		String(entity.name || entity.title || fallback || "").trim()
	);
}

function getLocationLabel(entity = {}, fallback) {
	return String(entity.name || entity.title || fallback || "").trim();
}

function getSessionDetail(sessionDetails, fileName) {
	if (!sessionDetails || !fileName) return null;
	if (sessionDetails instanceof Map)
		return sessionDetails.get(fileName) || null;
	if (Array.isArray(sessionDetails)) {
		return (
			sessionDetails.find((session) => session?.fileName === fileName) || null
		);
	}
	return sessionDetails[fileName] || null;
}

function encodedPart(value) {
	return encodeURIComponent(String(value ?? ""));
}

function buildNodeSearchText(node) {
	return normalizeGraphName(
		[
			node.label,
			node.type,
			node.summary,
			node.meta?.fileName,
			node.meta?.sourceSlug,
		].join(" "),
	);
}

function sortNodesByPriority(left, right) {
	const leftPriority = TYPE_PRIORITY.indexOf(left.type);
	const rightPriority = TYPE_PRIORITY.indexOf(right.type);
	const safeLeftPriority =
		leftPriority === -1 ? TYPE_PRIORITY.length : leftPriority;
	const safeRightPriority =
		rightPriority === -1 ? TYPE_PRIORITY.length : rightPriority;
	if (safeLeftPriority !== safeRightPriority) {
		return safeLeftPriority - safeRightPriority;
	}
	return left.label.localeCompare(right.label, "uk");
}

export function buildCampaignGraph({
	campaign = {},
	description = "",
	notes = [],
	characters = [],
	npcs = [],
	locations = [],
	sessions = [],
	sessionDetails = {},
	simplifiedNotes = false,
} = {}) {
	const nodesById = new Map();
	const aliases = new Map();
	const edgesById = new Map();
	const pendingMentionEdges = [];
	const campaignId = `campaign:${encodedPart(campaign.slug || "current")}`;

	const addNode = (node) => {
		if (!node?.id || nodesById.has(node.id)) return nodesById.get(node?.id);
		const nextNode = {
			...node,
			label: String(node.label || "").trim() || "Untitled",
			meta: node.meta || {},
		};
		nextNode.searchText = buildNodeSearchText(nextNode);
		nodesById.set(nextNode.id, nextNode);

		(node.aliases || [nextNode.label]).forEach((alias) => {
			const key = normalizeGraphName(alias);
			if (!key) return;
			const current = aliases.get(key) || [];
			current.push(nextNode.id);
			aliases.set(key, current);
		});

		return nextNode;
	};

	const addEdge = (source, target, relation, sourceInfo = {}) => {
		if (!source || !target || source === target) return;
		const [edgeSource, edgeTarget] =
			relation === "related" && source.localeCompare(target) > 0
				? [target, source]
				: [source, target];
		const id = `${relation}:${edgeSource}->${edgeTarget}`;
		const current = edgesById.get(id);
		if (current) {
			current.count += 1;
			current.sources.push(sourceInfo);
			return;
		}

		edgesById.set(id, {
			id,
			source: edgeSource,
			target: edgeTarget,
			relation,
			count: 1,
			sources: [sourceInfo],
		});
	};

	const resolveMention = (name) => {
		const key = normalizeGraphName(name);
		if (!key) return null;
		const matches = aliases.get(key) || [];
		if (matches.length > 0) {
			return [...matches].sort((leftId, rightId) => {
				const left = nodesById.get(leftId);
				const right = nodesById.get(rightId);
				return sortNodesByPriority(left, right);
			})[0];
		}

		const unresolvedId = `unresolved:${encodedPart(key)}`;
		addNode({
			id: unresolvedId,
			type: "unresolved",
			label: name,
			summary: "",
			aliases: [name],
			meta: {
				normalizedName: key,
			},
		});
		return unresolvedId;
	};

	const addMentionEdges = (
		sourceId,
		sourceLabel,
		mentions,
		sourceType,
		{ includeRelated = true } = {},
	) => {
		mentions.forEach((mention) => {
			const targetId = resolveMention(mention.name);
			if (!targetId) return;
			addEdge(sourceId, targetId, "mentions", {
				type: sourceType,
				label: sourceLabel,
				field: mention.field,
				mention: mention.name,
			});
		});

		if (!includeRelated) return;

		const mentionsByField = new Map();
		mentions.forEach((mention) => {
			const fieldMentions = mentionsByField.get(mention.field) || [];
			fieldMentions.push(mention);
			mentionsByField.set(mention.field, fieldMentions);
		});

		mentionsByField.forEach((fieldMentions, field) => {
			const relatedTargets = [];
			const seenTargets = new Set();
			fieldMentions.forEach((mention) => {
				const targetId = resolveMention(mention.name);
				if (!targetId || targetId === sourceId || seenTargets.has(targetId)) {
					return;
				}
				seenTargets.add(targetId);
				relatedTargets.push({
					id: targetId,
					name: mention.name,
				});
			});

			for (
				let leftIndex = 0;
				leftIndex < relatedTargets.length;
				leftIndex += 1
			) {
				for (
					let rightIndex = leftIndex + 1;
					rightIndex < relatedTargets.length;
					rightIndex += 1
				) {
					const left = relatedTargets[leftIndex];
					const right = relatedTargets[rightIndex];
					addEdge(left.id, right.id, "related", {
						type: sourceType,
						label: sourceLabel,
						field,
						mentions: [left.name, right.name],
						via: sourceId,
					});
				}
			}
		});
	};

	const queueMentionEdges = (
		sourceId,
		sourceLabel,
		mentions,
		sourceType,
		propagateTo = [],
	) => {
		pendingMentionEdges.push({
			sourceId,
			sourceLabel,
			mentions,
			sourceType,
			propagateTo,
		});
	};

	addNode({
		id: campaignId,
		type: "campaign",
		label: campaign.name || campaign.slug || "Campaign",
		summary: excerpt(description),
		detailText: description,
		aliases: [campaign.name, campaign.slug].filter(Boolean),
		meta: {
			sourceSlug: campaign.slug,
		},
	});

	const campaignMentions = getMentionsFromValue(description, "description");
	queueMentionEdges(
		campaignId,
		campaign.name || campaign.slug,
		campaignMentions,
		"campaign",
	);

	(notes || []).forEach((note, index) => {
		if (!note || note._isVirtual || isEmptyNote(note)) return;
		const noteId = `campaign-note:${encodedPart(note.id ?? index)}`;
		const noteLabel =
			(!simplifiedNotes && String(note.title || "").trim()) ||
			excerpt(note.text, 48, { stripMarkdown: true }) ||
			`Note ${index + 1}`;
		addNode({
			id: noteId,
			type: "campaign-note",
			label: noteLabel,
			summary: excerpt(note.text || note.title, 160, { stripMarkdown: true }),
			detailText: note.text || "",
			aliases: simplifiedNotes ? [] : [note.title].filter(Boolean),
			sourceId: note.id,
			meta: {
				parentId: campaignId,
				isSimplifiedNote: Boolean(simplifiedNotes),
			},
		});
		addEdge(campaignId, noteId, "contains", {
			type: "campaign",
			label: campaign.name || campaign.slug,
			field: "notes",
		});
		queueMentionEdges(
			noteId,
			noteLabel,
			getMentionsFromValue(note, "note"),
			"campaign-note",
			[{ sourceId: campaignId, sourceLabel: campaign.name || campaign.slug }],
		);
	});

	(characters || []).forEach((character, index) => {
		const label = getCharacterLabel(character, `Character ${index + 1}`);
		const characterId = `character:${encodedPart(character.id ?? character.slug ?? index)}`;
		addNode({
			id: characterId,
			type: "character",
			label,
			summary: excerpt(
				[
					character.race,
					character.class,
					character.motivation,
					character.description,
					character.trait,
				]
					.filter(Boolean)
					.join(" "),
			),
			detailText: [character.description, character.motivation, character.trait]
				.filter(Boolean)
				.join("\n\n"),
			aliases: [
				label,
				character.firstName,
				character.name,
				character.title,
			].filter(Boolean),
			sourceId: character.id,
			sourceSlug: character.slug,
			meta: {
				sourceSlug: character.slug,
			},
		});
		addEdge(campaignId, characterId, "contains", {
			type: "campaign",
			label: campaign.name || campaign.slug,
			field: "characters",
		});
		queueMentionEdges(
			characterId,
			label,
			getMentionsFromValue(character, "character"),
			"character",
		);
	});

	(npcs || []).forEach((npc, index) => {
		const label = getCharacterLabel(npc, `NPC ${index + 1}`);
		const npcId = `npc:${encodedPart(npc.id ?? npc.slug ?? index)}`;
		addNode({
			id: npcId,
			type: "npc",
			label,
			summary: excerpt(
				[npc.race, npc.class, npc.description, npc.motivation, npc.trait]
					.filter(Boolean)
					.join(" "),
			),
			detailText: [npc.description, npc.motivation, npc.trait]
				.filter(Boolean)
				.join("\n\n"),
			aliases: [label, npc.firstName, npc.name, npc.title].filter(Boolean),
			sourceId: npc.id,
			sourceSlug: npc.slug,
			meta: {
				sourceSlug: npc.slug,
			},
		});
		addEdge(campaignId, npcId, "contains", {
			type: "campaign",
			label: campaign.name || campaign.slug,
			field: "npc",
		});
		queueMentionEdges(npcId, label, getMentionsFromValue(npc, "npc"), "npc");
	});

	(locations || []).forEach((location, index) => {
		const label = getLocationLabel(location, `Location ${index + 1}`);
		const locationId = `location:${encodedPart(location.id ?? location.slug ?? index)}`;
		addNode({
			id: locationId,
			type: "location",
			label,
			summary: excerpt(location.description),
			detailText: location.description || "",
			aliases: [label, location.name, location.title].filter(Boolean),
			sourceId: location.id,
			sourceSlug: location.slug,
			meta: {
				sourceSlug: location.slug,
			},
		});
		addEdge(campaignId, locationId, "contains", {
			type: "campaign",
			label: campaign.name || campaign.slug,
			field: "locations",
		});
		queueMentionEdges(
			locationId,
			label,
			getMentionsFromValue(location, "location"),
			"location",
		);
	});

	(sessions || []).forEach((session, index) => {
		const fileName = session.fileName || `session-${index}`;
		const sessionId = `session:${encodedPart(fileName)}`;
		const detail = getSessionDetail(sessionDetails, fileName);
		const sessionData = detail?.data || {};
		const label = session.name || detail?.name || `Session ${index + 1}`;

		addNode({
			id: sessionId,
			type: "session",
			label,
			summary: excerpt(sessionData.result_text || detail?.name || session.name),
			detailText: sessionData.result_text || "",
			aliases: [session.name, detail?.name, fileName].filter(Boolean),
			sourceId: detail?.id || session.id,
			meta: {
				fileName,
			},
		});
		addEdge(campaignId, sessionId, "contains", {
			type: "campaign",
			label: campaign.name || campaign.slug,
			field: "sessions",
		});

		if (!detail) return;

		const resultMentions = getMentionsFromValue(
			sessionData.result_text || "",
			"result_text",
		);
		queueMentionEdges(sessionId, label, resultMentions, "session");

		(sessionData.npcs || []).forEach((npc, npcIndex) => {
			const npcLabel = getCharacterLabel(npc, `NPC ${npcIndex + 1}`);
			const npcId = `session-npc:${encodedPart(fileName)}:${encodedPart(npc.id ?? npc.slug ?? npcIndex)}`;
			addNode({
				id: npcId,
				type: "npc",
				label: npcLabel,
				summary: excerpt(
					[npc.race, npc.class, npc.description, npc.motivation, npc.trait]
						.filter(Boolean)
						.join(" "),
				),
				detailText: [npc.description, npc.motivation, npc.trait]
					.filter(Boolean)
					.join("\n\n"),
				aliases: [npcLabel, npc.firstName, npc.name, npc.title].filter(Boolean),
				sourceId: npc.id,
				sourceSlug: npc.slug,
				meta: {
					fileName,
					parentId: sessionId,
					scope: "session",
					sourceSlug: npc.slug,
				},
			});
			addEdge(sessionId, npcId, "contains", {
				type: "session",
				label,
				field: "npcs",
			});
			queueMentionEdges(
				npcId,
				npcLabel,
				getMentionsFromValue(npc, "npc"),
				"npc",
			);
		});

		(sessionData.locations || []).forEach((location, locationIndex) => {
			const locationLabel = getLocationLabel(
				location,
				`Location ${locationIndex + 1}`,
			);
			const locationId = `session-location:${encodedPart(fileName)}:${encodedPart(location.id ?? location.slug ?? locationIndex)}`;
			addNode({
				id: locationId,
				type: "location",
				label: locationLabel,
				summary: excerpt(location.description),
				detailText: location.description || "",
				aliases: [locationLabel, location.name, location.title].filter(Boolean),
				sourceId: location.id,
				sourceSlug: location.slug,
				meta: {
					fileName,
					parentId: sessionId,
					scope: "session",
					sourceSlug: location.slug,
				},
			});
			addEdge(sessionId, locationId, "contains", {
				type: "session",
				label,
				field: "locations",
			});
			queueMentionEdges(
				locationId,
				locationLabel,
				getMentionsFromValue(location, "location"),
				"location",
			);
		});

		(sessionData.notes || []).forEach((note, noteIndex) => {
			if (!note || note._isVirtual || isEmptyNote(note)) return;
			const sessionNoteId = `session-note:${encodedPart(fileName)}:${encodedPart(note.id ?? noteIndex)}`;
			const sessionNoteLabel =
				(!simplifiedNotes && String(note.title || "").trim()) ||
				excerpt(note.text, 48, { stripMarkdown: true }) ||
				`${label} note ${noteIndex + 1}`;
			addNode({
				id: sessionNoteId,
				type: "session-note",
				label: sessionNoteLabel,
				summary: excerpt(note.text || note.title, 160, {
					stripMarkdown: true,
				}),
				detailText: note.text || "",
				aliases: simplifiedNotes ? [] : [note.title].filter(Boolean),
				sourceId: note.id,
				meta: {
					fileName,
					parentId: sessionId,
					isSimplifiedNote: Boolean(simplifiedNotes),
				},
			});
			addEdge(sessionId, sessionNoteId, "contains", {
				type: "session",
				label,
				field: "notes",
			});
			const sessionNoteMentions = getMentionsFromValue(note, "session.note");
			queueMentionEdges(
				sessionNoteId,
				sessionNoteLabel,
				sessionNoteMentions,
				"session-note",
				[{ sourceId: sessionId, sourceLabel: label }],
			);
		});

		const sceneNodeIds = [];
		(sessionData.scenes || []).forEach((scene, sceneIndex) => {
			const sceneId = `scene:${encodedPart(fileName)}:${encodedPart(scene.id ?? sceneIndex)}`;
			const sceneName = `Scene ${sceneIndex + 1}`;
			sceneNodeIds.push(sceneId);
			const sceneSummary = excerpt(
				[
					scene?.texts?.summary,
					scene?.texts?.goal,
					scene?.texts?.location,
					scene?.texts?.stakes,
				]
					.filter(Boolean)
					.join(" "),
			);

			addNode({
				id: sceneId,
				type: "scene",
				label: `${label}: ${sceneName}`,
				summary: sceneSummary,
				detailText: Object.values(scene?.texts || {})
					.filter(Boolean)
					.join("\n\n"),
				aliases: [sceneName, `${label} ${sceneName}`],
				sourceId: scene.id,
				meta: {
					fileName,
					parentId: sessionId,
					sceneNumber: sceneIndex + 1,
				},
			});
			addEdge(sessionId, sceneId, "contains", {
				type: "session",
				label,
				field: "scenes",
			});
			const sceneMentions = getMentionsFromValue(scene.texts || scene, "scene");
			queueMentionEdges(
				sceneId,
				`${label}: ${sceneName}`,
				sceneMentions,
				"scene",
				[{ sourceId: sessionId, sourceLabel: label }],
			);

			(scene.notes || []).forEach((note, noteIndex) => {
				if (!note || note._isVirtual || isEmptyNote(note)) return;
				const sceneNoteId = `scene-note:${encodedPart(fileName)}:${encodedPart(scene.id ?? sceneIndex)}:${encodedPart(note.id ?? noteIndex)}`;
				const sceneNoteLabel =
					(!simplifiedNotes && String(note.title || "").trim()) ||
					excerpt(note.text, 48, { stripMarkdown: true }) ||
					`${sceneName} note ${noteIndex + 1}`;
				addNode({
					id: sceneNoteId,
					type: "scene-note",
					label: sceneNoteLabel,
					summary: excerpt(note.text || note.title, 160, {
						stripMarkdown: true,
					}),
					detailText: note.text || "",
					aliases: simplifiedNotes ? [] : [note.title].filter(Boolean),
					sourceId: note.id,
					meta: {
						fileName,
						parentId: sceneId,
						sceneId: scene.id,
						sceneNumber: sceneIndex + 1,
						isSimplifiedNote: Boolean(simplifiedNotes),
					},
				});
				addEdge(sceneId, sceneNoteId, "contains", {
					type: "scene",
					label: `${label}: ${sceneName}`,
					field: "notes",
				});
				const sceneNoteMentions = getMentionsFromValue(note, "scene.note");
				queueMentionEdges(
					sceneNoteId,
					sceneNoteLabel,
					sceneNoteMentions,
					"scene-note",
					[
						{ sourceId: sceneId, sourceLabel: `${label}: ${sceneName}` },
						{ sourceId: sessionId, sourceLabel: label },
					],
				);
			});
		});

		sceneNodeIds.forEach((sceneId, sceneIndex) => {
			const nextSceneId = sceneNodeIds[sceneIndex + 1];
			if (!nextSceneId) return;
			addEdge(sceneId, nextSceneId, "sequence", {
				type: "session",
				label,
				field: "scenes",
			});
		});
	});

	pendingMentionEdges.forEach((entry) => {
		addMentionEdges(
			entry.sourceId,
			entry.sourceLabel,
			entry.mentions,
			entry.sourceType,
		);
		(entry.propagateTo || []).forEach((source) => {
			addMentionEdges(
				source.sourceId,
				source.sourceLabel,
				entry.mentions,
				entry.sourceType,
				{ includeRelated: false },
			);
		});
	});

	const nodes = [...nodesById.values()].map((node) => ({
		...node,
		degree: 0,
	}));
	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	const edges = [...edgesById.values()].filter(
		(edge) => nodeById.has(edge.source) && nodeById.has(edge.target),
	);

	edges.forEach((edge) => {
		const source = nodeById.get(edge.source);
		const target = nodeById.get(edge.target);
		if (source) source.degree += 1;
		if (target) target.degree += 1;
	});

	return {
		nodes,
		edges,
		stats: {
			nodes: nodes.length,
			edges: edges.length,
			unresolved: nodes.filter((node) => node.type === "unresolved").length,
		},
	};
}
