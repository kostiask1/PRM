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

export interface CampaignGraphRecord extends Record<string, unknown> {
	id?: unknown;
	slug?: unknown;
	fileName?: string;
	name?: unknown;
	title?: unknown;
	firstName?: unknown;
	lastName?: unknown;
	text?: unknown;
	description?: unknown;
	notes?: CampaignGraphRecord[];
	scenes?: CampaignGraphRecord[];
	npcs?: CampaignGraphRecord[];
	locations?: CampaignGraphRecord[];
	texts?: Record<string, unknown>;
	data?: CampaignGraphRecord;
	_isVirtual?: boolean;
}

export interface CampaignGraphNodeMeta extends Record<string, unknown> {
	fileName?: string;
	sourceSlug?: unknown;
	parentId?: string;
	scope?: string;
	sceneId?: unknown;
	isSimplifiedNote?: boolean;
}

export interface CampaignGraphNode extends Record<string, unknown> {
	id: string;
	type: string;
	label: string;
	summary?: string;
	detailText?: unknown;
	aliases?: unknown[];
	sourceId?: unknown;
	sourceSlug?: unknown;
	meta: CampaignGraphNodeMeta;
	searchText: string;
	degree: number;
}

interface CampaignGraphNodeInput extends Record<string, unknown> {
	id: string;
	type: string;
	label?: unknown;
	summary?: string;
	detailText?: unknown;
	aliases?: unknown[];
	sourceId?: unknown;
	sourceSlug?: unknown;
	meta?: CampaignGraphNodeMeta;
}

export interface CampaignGraphEdge extends Record<string, unknown> {
	id: string;
	source: string;
	target: string;
	relation: string;
	count: number;
	sources: Record<string, unknown>[];
}

export interface CampaignGraphResult {
	nodes: CampaignGraphNode[];
	edges: CampaignGraphEdge[];
	stats: { nodes: number; edges: number; unresolved: number };
}

export interface CampaignGraphInput {
	campaign?: CampaignGraphRecord;
	description?: unknown;
	notes?: CampaignGraphRecord[];
	characters?: CampaignGraphRecord[];
	npcs?: CampaignGraphRecord[];
	locations?: CampaignGraphRecord[];
	sessions?: CampaignGraphRecord[];
	sessionDetails?:
		| Map<string, CampaignGraphRecord>
		| CampaignGraphRecord[]
		| Record<string, CampaignGraphRecord>;
	simplifiedNotes?: boolean;
}

interface GraphTextField {
	value: string;
	field: string;
}

interface GraphMention {
	name: string;
	field: string;
}

interface PendingMentionEdge {
	sourceId: string;
	sourceLabel: unknown;
	mentions: GraphMention[];
	sourceType: string;
	propagateTo: Array<{ sourceId: string; sourceLabel: unknown }>;
}

export function normalizeGraphName(value: unknown): string {
	return String(value || "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();
}

export function extractBracketMentions(text: unknown): string[] {
	if (typeof text !== "string" || !text.includes("[")) return [];

	const mentions: string[] = [];
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

function isEmptyNote(note: CampaignGraphRecord = {}): boolean {
	return (
		String(note.title || "").trim().length === 0 &&
		String(note.text || "").trim().length === 0
	);
}

function stripMarkdownForGraphText(value: unknown): string {
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

function excerpt(
	value: unknown,
	maxLength = 160,
	{ stripMarkdown = false }: { stripMarkdown?: boolean } = {},
): string {
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

function collectStrings(
	value: unknown,
	path = "",
	output: GraphTextField[] = [],
): GraphTextField[] {
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

function getMentionsFromValue(value: unknown, sourceField: string): GraphMention[] {
	return collectStrings(value, sourceField).flatMap(({ value: text, field }) =>
		extractBracketMentions(text).map((name) => ({ name, field })),
	);
}

function getCharacterLabel(
	entity: CampaignGraphRecord = {},
	fallback?: string,
): string {
	return (
		`${entity.firstName || ""} ${entity.lastName || ""}`.trim() ||
		String(entity.name || entity.title || fallback || "").trim()
	);
}

function getLocationLabel(
	entity: CampaignGraphRecord = {},
	fallback?: string,
): string {
	return String(entity.name || entity.title || fallback || "").trim();
}

function getSessionDetail(
	sessionDetails: CampaignGraphInput["sessionDetails"],
	fileName: string,
): CampaignGraphRecord | null {
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

function encodedPart(value: unknown): string {
	return encodeURIComponent(String(value ?? ""));
}

function buildNodeSearchText(node: CampaignGraphNode): string {
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

function sortNodesByPriority(
	left: CampaignGraphNode,
	right: CampaignGraphNode,
): number {
	const leftPriority = TYPE_PRIORITY.indexOf(left.type);
	const rightPriority = TYPE_PRIORITY.indexOf(right.type);
	const safeLeftPriority =
		leftPriority === -1 ? TYPE_PRIORITY.length : leftPriority;
	const safeRightPriority =
		rightPriority === -1 ? TYPE_PRIORITY.length : rightPriority;
	if (safeLeftPriority !== safeRightPriority) {
		return safeLeftPriority - safeRightPriority;
	}
	return left.label.localeCompare(right.label);
}

interface CampaignGraphProjectionCommands {
	addNode(node: CampaignGraphNodeInput): CampaignGraphNode | undefined;
	addEdge(
		source: string | null | undefined,
		target: string | null | undefined,
		relation: string,
		sourceInfo?: Record<string, unknown>,
	): void;
	queueMentionEdges(
		sourceId: string,
		sourceLabel: unknown,
		mentions: GraphMention[],
		sourceType: string,
		propagateTo?: PendingMentionEdge["propagateTo"],
	): void;
}

interface SessionGraphProjectionContext {
	fileName: string;
	sessionId: string;
	label: unknown;
	simplifiedNotes: boolean;
}

interface GraphNoteProjectionInput {
	note: CampaignGraphRecord;
	noteIndex: number;
	nodeIdPrefix: string;
	nodeType: "campaign-note" | "session-note" | "scene-note";
	parentId: string;
	parentType: "campaign" | "session" | "scene";
	parentLabel: unknown;
	fallbackLabel: string;
	mentionField: "note" | "session.note" | "scene.note";
	propagateTo: PendingMentionEdge["propagateTo"];
	meta: CampaignGraphNodeMeta;
	simplifiedNotes: boolean;
}

function getGraphNoteLabel(input: GraphNoteProjectionInput): string {
	const { note, fallbackLabel, simplifiedNotes } = input;
	if (!simplifiedNotes) {
		const title = String(note.title || "").trim();
		if (title) return title;
	}
	return excerpt(note.text, 48, { stripMarkdown: true }) || fallbackLabel;
}

function createGraphNoteNode(
	input: GraphNoteProjectionInput,
	noteId: string,
	noteLabel: string,
): CampaignGraphNodeInput {
	const { note, nodeType, parentId, meta, simplifiedNotes } = input;
	return {
		id: noteId,
		type: nodeType,
		label: noteLabel,
		summary: excerpt(note.text || note.title, 160, { stripMarkdown: true }),
		detailText: note.text || "",
		aliases: simplifiedNotes ? [] : [note.title].filter(Boolean),
		sourceId: note.id,
		meta: {
			...meta,
			parentId,
			isSimplifiedNote: Boolean(simplifiedNotes),
		},
	};
}

function projectGraphNote(
	{
		note,
		noteIndex,
		nodeIdPrefix,
		nodeType,
		parentId,
		parentType,
		parentLabel,
		fallbackLabel,
		mentionField,
		propagateTo,
		meta,
		simplifiedNotes,
	}: GraphNoteProjectionInput,
	commands: CampaignGraphProjectionCommands,
): void {
	if (!note || note._isVirtual || isEmptyNote(note)) return;
	const noteId = `${nodeIdPrefix}:${encodedPart(note.id ?? noteIndex)}`;
	const noteLabel = getGraphNoteLabel({
		note,
		noteIndex,
		nodeIdPrefix,
		nodeType,
		parentId,
		parentType,
		parentLabel,
		fallbackLabel,
		mentionField,
		propagateTo,
		meta,
		simplifiedNotes,
	});
	commands.addNode(
		createGraphNoteNode(
			{
				note,
				noteIndex,
				nodeIdPrefix,
				nodeType,
				parentId,
				parentType,
				parentLabel,
				fallbackLabel,
				mentionField,
				propagateTo,
				meta,
				simplifiedNotes,
			},
			noteId,
			noteLabel,
		),
	);
	commands.addEdge(parentId, noteId, "contains", {
		type: parentType,
		label: parentLabel,
		field: "notes",
	});
	commands.queueMentionEdges(
		noteId,
		noteLabel,
		getMentionsFromValue(note, mentionField),
		nodeType,
		propagateTo,
	);
}

function projectCampaignNote(
	note: CampaignGraphRecord,
	noteIndex: number,
	campaignId: string,
	campaignLabel: unknown,
	simplifiedNotes: boolean,
	commands: CampaignGraphProjectionCommands,
): void {
	projectGraphNote(
		{
			note,
			noteIndex,
			nodeIdPrefix: "campaign-note",
			nodeType: "campaign-note",
			parentId: campaignId,
			parentType: "campaign",
			parentLabel: campaignLabel,
			fallbackLabel: `Note ${noteIndex + 1}`,
			mentionField: "note",
			propagateTo: [{ sourceId: campaignId, sourceLabel: campaignLabel }],
			meta: {},
			simplifiedNotes,
		},
		commands,
	);
}

function projectSessionNpc(
	npc: CampaignGraphRecord,
	npcIndex: number,
	context: SessionGraphProjectionContext,
	commands: CampaignGraphProjectionCommands,
): void {
	const npcLabel = getCharacterLabel(npc, `NPC ${npcIndex + 1}`);
	const npcId = `session-npc:${encodedPart(context.fileName)}:${encodedPart(npc.id ?? npc.slug ?? npcIndex)}`;
	commands.addNode({
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
			fileName: context.fileName,
			parentId: context.sessionId,
			scope: "session",
			sourceSlug: npc.slug,
		},
	});
	commands.addEdge(context.sessionId, npcId, "contains", {
		type: "session",
		label: context.label,
		field: "npcs",
	});
	commands.queueMentionEdges(
		npcId,
		npcLabel,
		getMentionsFromValue(npc, "npc"),
		"npc",
	);
}

function projectSessionLocation(
	location: CampaignGraphRecord,
	locationIndex: number,
	context: SessionGraphProjectionContext,
	commands: CampaignGraphProjectionCommands,
): void {
	const locationLabel = getLocationLabel(
		location,
		`Location ${locationIndex + 1}`,
	);
	const locationId = `session-location:${encodedPart(context.fileName)}:${encodedPart(location.id ?? location.slug ?? locationIndex)}`;
	commands.addNode({
		id: locationId,
		type: "location",
		label: locationLabel,
		summary: excerpt(location.description),
		detailText: location.description || "",
		aliases: [locationLabel, location.name, location.title].filter(Boolean),
		sourceId: location.id,
		sourceSlug: location.slug,
		meta: {
			fileName: context.fileName,
			parentId: context.sessionId,
			scope: "session",
			sourceSlug: location.slug,
		},
	});
	commands.addEdge(context.sessionId, locationId, "contains", {
		type: "session",
		label: context.label,
		field: "locations",
	});
	commands.queueMentionEdges(
		locationId,
		locationLabel,
		getMentionsFromValue(location, "location"),
		"location",
	);
}

function projectSessionNote(
	note: CampaignGraphRecord,
	noteIndex: number,
	context: SessionGraphProjectionContext,
	commands: CampaignGraphProjectionCommands,
): void {
	projectGraphNote(
		{
			note,
			noteIndex,
			nodeIdPrefix: `session-note:${encodedPart(context.fileName)}`,
			nodeType: "session-note",
			parentId: context.sessionId,
			parentType: "session",
			parentLabel: context.label,
			fallbackLabel: `${context.label} note ${noteIndex + 1}`,
			mentionField: "session.note",
			propagateTo: [
				{ sourceId: context.sessionId, sourceLabel: context.label },
			],
			meta: { fileName: context.fileName },
			simplifiedNotes: context.simplifiedNotes,
		},
		commands,
	);
}

function projectSceneNote(
	note: CampaignGraphRecord,
	noteIndex: number,
	scene: CampaignGraphRecord,
	sceneIndex: number,
	sceneId: string,
	sceneLabel: string,
	sceneName: string,
	context: SessionGraphProjectionContext,
	commands: CampaignGraphProjectionCommands,
): void {
	projectGraphNote(
		{
			note,
			noteIndex,
			nodeIdPrefix: `scene-note:${encodedPart(context.fileName)}:${encodedPart(scene.id ?? sceneIndex)}`,
			nodeType: "scene-note",
			parentId: sceneId,
			parentType: "scene",
			parentLabel: sceneLabel,
			fallbackLabel: `${sceneName} note ${noteIndex + 1}`,
			mentionField: "scene.note",
			propagateTo: [
				{ sourceId: sceneId, sourceLabel: sceneLabel },
				{ sourceId: context.sessionId, sourceLabel: context.label },
			],
			meta: {
				fileName: context.fileName,
				sceneId: scene.id,
				sceneNumber: sceneIndex + 1,
			},
			simplifiedNotes: context.simplifiedNotes,
		},
		commands,
	);
}

function projectSessionScene(
	scene: CampaignGraphRecord,
	sceneIndex: number,
	context: SessionGraphProjectionContext,
	commands: CampaignGraphProjectionCommands,
): string {
	const sceneId = `scene:${encodedPart(context.fileName)}:${encodedPart(scene.id ?? sceneIndex)}`;
	const sceneName = `Scene ${sceneIndex + 1}`;
	const sceneLabel = `${context.label}: ${sceneName}`;
	const sceneSummary = excerpt(
		[
			scene.texts?.summary,
			scene.texts?.goal,
			scene.texts?.location,
			scene.texts?.stakes,
		]
			.filter(Boolean)
			.join(" "),
	);
	commands.addNode({
		id: sceneId,
		type: "scene",
		label: sceneLabel,
		summary: sceneSummary,
		detailText: Object.values(scene.texts || {})
			.filter(Boolean)
			.join("\n\n"),
		aliases: [sceneName, `${context.label} ${sceneName}`],
		sourceId: scene.id,
		meta: {
			fileName: context.fileName,
			parentId: context.sessionId,
			sceneNumber: sceneIndex + 1,
		},
	});
	commands.addEdge(context.sessionId, sceneId, "contains", {
		type: "session",
		label: context.label,
		field: "scenes",
	});
	commands.queueMentionEdges(
		sceneId,
		sceneLabel,
		getMentionsFromValue(scene.texts || scene, "scene"),
		"scene",
		[{ sourceId: context.sessionId, sourceLabel: context.label }],
	);
	(scene.notes || []).forEach((note, noteIndex) => {
		projectSceneNote(
			note,
			noteIndex,
			scene,
			sceneIndex,
			sceneId,
			sceneLabel,
			sceneName,
			context,
			commands,
		);
	});
	return sceneId;
}

function projectSessionScenes(
	scenes: CampaignGraphRecord[],
	context: SessionGraphProjectionContext,
	commands: CampaignGraphProjectionCommands,
): void {
	const sceneNodeIds = scenes.map((scene, sceneIndex) =>
		projectSessionScene(scene, sceneIndex, context, commands),
	);
	sceneNodeIds.forEach((sceneId, sceneIndex) => {
		const nextSceneId = sceneNodeIds[sceneIndex + 1];
		if (!nextSceneId) return;
		commands.addEdge(sceneId, nextSceneId, "sequence", {
			type: "session",
			label: context.label,
			field: "scenes",
		});
	});
}

interface CampaignSessionProjection {
	detail: CampaignGraphRecord | null;
	sessionData: CampaignGraphRecord;
	context: SessionGraphProjectionContext;
}

function createCampaignSessionProjection(
	session: CampaignGraphRecord,
	index: number,
	input: Pick<CampaignGraphInput, "sessionDetails" | "simplifiedNotes">,
): CampaignSessionProjection {
	const fileName = session.fileName || `session-${index}`;
	const detail = getSessionDetail(input.sessionDetails, fileName);
	const sessionData = detail?.data || {};
	return {
		detail,
		sessionData,
		context: {
			fileName,
			sessionId: `session:${encodedPart(fileName)}`,
			label: session.name || detail?.name || `Session ${index + 1}`,
			simplifiedNotes: Boolean(input.simplifiedNotes),
		},
	};
}

function createCampaignSessionNode(
	session: CampaignGraphRecord,
	projection: CampaignSessionProjection,
): CampaignGraphNodeInput {
	const { context, detail, sessionData } = projection;
	return {
		id: context.sessionId,
		type: "session",
		label: context.label,
		summary: excerpt(sessionData.result_text || detail?.name || session.name),
		detailText: sessionData.result_text || "",
		aliases: [session.name, detail?.name, context.fileName].filter(Boolean),
		sourceId: detail?.id || session.id,
		meta: { fileName: context.fileName },
	};
}

function projectCampaignSessionDetail(
	projection: CampaignSessionProjection,
	commands: CampaignGraphProjectionCommands,
): void {
	const { context, sessionData } = projection;
	commands.queueMentionEdges(
		context.sessionId,
		context.label,
		getMentionsFromValue(sessionData.result_text || "", "result_text"),
		"session",
	);
	(sessionData.npcs || []).forEach((npc, npcIndex) =>
		projectSessionNpc(npc, npcIndex, context, commands),
	);
	(sessionData.locations || []).forEach((location, locationIndex) =>
		projectSessionLocation(location, locationIndex, context, commands),
	);
	(sessionData.notes || []).forEach((note, noteIndex) =>
		projectSessionNote(note, noteIndex, context, commands),
	);
	projectSessionScenes(sessionData.scenes || [], context, commands);
}

function projectCampaignSession(
	session: CampaignGraphRecord,
	index: number,
	input: Pick<CampaignGraphInput, "sessionDetails" | "simplifiedNotes">,
	campaignId: string,
	campaignLabel: unknown,
	commands: CampaignGraphProjectionCommands,
): void {
	const projection = createCampaignSessionProjection(session, index, input);
	commands.addNode(createCampaignSessionNode(session, projection));
	commands.addEdge(campaignId, projection.context.sessionId, "contains", {
		type: "campaign",
		label: campaignLabel,
		field: "sessions",
	});
	if (projection.detail) projectCampaignSessionDetail(projection, commands);
}

function getCampaignSourceLabel(campaign: CampaignGraphRecord): unknown {
	return campaign.name || campaign.slug;
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
}: CampaignGraphInput = {}): CampaignGraphResult {
	const nodesById = new Map<string, CampaignGraphNode>();
	const aliases = new Map<string, string[]>();
	const edgesById = new Map<string, CampaignGraphEdge>();
	const pendingMentionEdges: PendingMentionEdge[] = [];
	const campaignId = `campaign:${encodedPart(campaign.slug || "current")}`;
	const campaignSourceLabel = getCampaignSourceLabel(campaign);

	const addNode = (node: CampaignGraphNodeInput): CampaignGraphNode | undefined => {
		if (!node.id || nodesById.has(node.id)) return nodesById.get(node.id);
		const nextNode: CampaignGraphNode = {
			...node,
			label: String(node.label || "").trim() || "Untitled",
			meta: node.meta || {},
			searchText: "",
			degree: 0,
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

	const addEdge = (
		source: string | null | undefined,
		target: string | null | undefined,
		relation: string,
		sourceInfo: Record<string, unknown> = {},
	): void => {
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

	const resolveMention = (name: string): string | null => {
		const key = normalizeGraphName(name);
		if (!key) return null;
		const matches = aliases.get(key) || [];
		if (matches.length > 0) {
			return [...matches].sort((leftId, rightId) => {
				const left = nodesById.get(leftId);
				const right = nodesById.get(rightId);
				if (!left || !right) return leftId.localeCompare(rightId);
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
		sourceId: string,
		sourceLabel: unknown,
		mentions: GraphMention[],
		sourceType: string,
		{ includeRelated = true }: { includeRelated?: boolean } = {},
	): void => {
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

		const mentionsByField = new Map<string, GraphMention[]>();
		mentions.forEach((mention) => {
			const fieldMentions = mentionsByField.get(mention.field) || [];
			fieldMentions.push(mention);
			mentionsByField.set(mention.field, fieldMentions);
		});

		mentionsByField.forEach((fieldMentions, field) => {
			const relatedTargets: Array<{ id: string; name: string }> = [];
			const seenTargets = new Set<string>();
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
		sourceId: string,
		sourceLabel: unknown,
		mentions: GraphMention[],
		sourceType: string,
		propagateTo: PendingMentionEdge["propagateTo"] = [],
	): void => {
		pendingMentionEdges.push({
			sourceId,
			sourceLabel,
			mentions,
			sourceType,
			propagateTo,
		});
	};
	const projectionCommands: CampaignGraphProjectionCommands = {
		addNode,
		addEdge,
		queueMentionEdges,
	};

	addNode({
		id: campaignId,
		type: "campaign",
		label: campaignSourceLabel || "Campaign",
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
		campaignSourceLabel,
		campaignMentions,
		"campaign",
	);

	(notes || []).forEach((note, index) => {
		projectCampaignNote(
			note,
			index,
			campaignId,
			campaignSourceLabel,
			Boolean(simplifiedNotes),
			projectionCommands,
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
			label: campaignSourceLabel,
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
			label: campaignSourceLabel,
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
			label: campaignSourceLabel,
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
		projectCampaignSession(
			session,
			index,
			{ sessionDetails, simplifiedNotes },
			campaignId,
			campaignSourceLabel,
			projectionCommands,
		);
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
