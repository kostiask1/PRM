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
	if (!isBracketMentionText(text)) return [];
	const mentions: string[] = [];
	const regex = /\[([^[\]\r\n]+)\]/g;
	let match;
	while ((match = regex.exec(text)) !== null) {
		appendBracketMention(match, mentions);
	}
	return mentions;
}

function isBracketMentionText(text: unknown): text is string {
	if (typeof text !== "string") return false;
	return text.includes("[");
}

function appendBracketMention(match: RegExpExecArray, mentions: string[]): void {
	const name = String(getTruthyCampaignGraphValue(match[1], ""))
		.trim()
		.replace(/\s+/g, " ");
	if (name) mentions.push(name);
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

type GraphTextValueKind = "empty" | "string" | "array" | "record" | "ignored";

const GRAPH_TEXT_VALUE_KIND_BY_TYPE: Partial<Record<string, GraphTextValueKind>> = {
	string: "string",
	object: "record",
};

function getGraphTextValueKind(value: unknown): GraphTextValueKind {
	if ([value === null, value === undefined].includes(true)) return "empty";
	if (Array.isArray(value)) return "array";
	return GRAPH_TEXT_VALUE_KIND_BY_TYPE[typeof value] ?? "ignored";
}

function collectGraphString(
	value: unknown,
	path: string,
	output: GraphTextField[],
): GraphTextField[] {
	const text = value as string;
	if (text.trim()) output.push({ value: text, field: path || "text" });
	return output;
}

function collectGraphArrayStrings(
	value: unknown,
	path: string,
	output: GraphTextField[],
): GraphTextField[] {
	(value as unknown[]).forEach((item, index) => {
		collectStrings(item, `${path}[${index}]`, output);
	});
	return output;
}

function isSearchableGraphTextEntry([key]: [string, unknown]): boolean {
	return !key.startsWith("_") && !IGNORED_TEXT_KEYS.has(key);
}

function getNestedGraphTextPath(path: string, key: string): string {
	return path ? `${path}.${key}` : key;
}

function collectGraphRecordStrings(
	value: unknown,
	path: string,
	output: GraphTextField[],
): GraphTextField[] {
	Object.entries(value as Record<string, unknown>)
		.filter(isSearchableGraphTextEntry)
		.forEach(([key, item]) => {
			collectStrings(item, getNestedGraphTextPath(path, key), output);
		});
	return output;
}

const GRAPH_TEXT_COLLECTORS: Record<
	GraphTextValueKind,
	(value: unknown, path: string, output: GraphTextField[]) => GraphTextField[]
> = {
	empty: (_value, _path, output) => output,
	string: collectGraphString,
	array: collectGraphArrayStrings,
	record: collectGraphRecordStrings,
	ignored: (_value, _path, output) => output,
};

function collectStrings(
	value: unknown,
	path = "",
	output: GraphTextField[] = [],
): GraphTextField[] {
	return GRAPH_TEXT_COLLECTORS[getGraphTextValueKind(value)](value, path, output);
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
	const fullName = [entity.firstName, entity.lastName]
		.map(stringifyTruthyCampaignGraphValue)
		.join(" ")
		.trim();
	return String(getFirstTruthyCampaignGraphValue([
		fullName,
		entity.name,
		entity.title,
		fallback,
	], "")).trim();
}

function stringifyTruthyCampaignGraphValue(value: unknown): string {
	return value ? String(value) : "";
}

function getFirstTruthyCampaignGraphValue<T>(values: T[], fallback: T): T {
	return values.find(Boolean) ?? fallback;
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
	return SESSION_DETAIL_READERS[getSessionDetailCollectionKind(sessionDetails)](
		sessionDetails,
		fileName,
	);
}

type SessionDetailCollection = NonNullable<CampaignGraphInput["sessionDetails"]>;
type SessionDetailCollectionKind = "map" | "array" | "record";

function getSessionDetailCollectionKind(
	sessionDetails: SessionDetailCollection,
): SessionDetailCollectionKind {
	if (sessionDetails instanceof Map) return "map";
	if (Array.isArray(sessionDetails)) return "array";
	return "record";
}

function readMapSessionDetail(
	sessionDetails: SessionDetailCollection,
	fileName: string,
): CampaignGraphRecord | null {
	return (sessionDetails as Map<string, CampaignGraphRecord>).get(fileName) || null;
}

function isSessionDetailForFile(
	session: CampaignGraphRecord | undefined,
	fileName: string,
): boolean {
	return session?.fileName === fileName;
}

function readArraySessionDetail(
	sessionDetails: SessionDetailCollection,
	fileName: string,
): CampaignGraphRecord | null {
	return (sessionDetails as CampaignGraphRecord[])
		.find((session) => isSessionDetailForFile(session, fileName)) || null;
}

function readRecordSessionDetail(
	sessionDetails: SessionDetailCollection,
	fileName: string,
): CampaignGraphRecord | null {
	return (sessionDetails as Record<string, CampaignGraphRecord>)[fileName] || null;
}

const SESSION_DETAIL_READERS: Record<
	SessionDetailCollectionKind,
	(sessionDetails: SessionDetailCollection, fileName: string) => CampaignGraphRecord | null
> = {
	map: readMapSessionDetail,
	array: readArraySessionDetail,
	record: readRecordSessionDetail,
};

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
	const title = getRegularGraphNoteTitle(input.note, input.simplifiedNotes);
	const text = excerpt(input.note.text, 48, { stripMarkdown: true });
	return getFirstTruthyCampaignGraphValue([title, text], input.fallbackLabel);
}

function getRegularGraphNoteTitle(
	note: CampaignGraphRecord,
	simplifiedNotes: boolean,
): string {
	if (simplifiedNotes) return "";
	return String(getTruthyCampaignGraphValue(note.title, "")).trim();
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
	input: GraphNoteProjectionInput,
	commands: CampaignGraphProjectionCommands,
): void {
	if (!isProjectableGraphNote(input.note)) return;
	const noteId = `${input.nodeIdPrefix}:${encodedPart(input.note.id ?? input.noteIndex)}`;
	const noteLabel = getGraphNoteLabel(input);
	commands.addNode(createGraphNoteNode(input, noteId, noteLabel));
	commands.addEdge(input.parentId, noteId, "contains", {
		type: input.parentType,
		label: input.parentLabel,
		field: "notes",
	});
	commands.queueMentionEdges(
		noteId,
		noteLabel,
		getMentionsFromValue(input.note, input.mentionField),
		input.nodeType,
		input.propagateTo,
	);
}

function isProjectableGraphNote(note: CampaignGraphRecord | null | undefined): note is CampaignGraphRecord {
	if (!note) return false;
	return [!note._isVirtual, !isEmptyNote(note)].every(Boolean);
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
	const projection = createSessionSceneProjection(scene, sceneIndex, context);
	commands.addNode({
		id: projection.id,
		type: "scene",
		label: projection.label,
		summary: projection.summary,
		detailText: projection.detailText,
		aliases: projection.aliases,
		sourceId: scene.id,
		meta: projection.meta,
	});
	commands.addEdge(context.sessionId, projection.id, "contains", {
		type: "session",
		label: context.label,
		field: "scenes",
	});
	commands.queueMentionEdges(
		projection.id,
		projection.label,
		getMentionsFromValue(projection.mentionSource, "scene"),
		"scene",
		[{ sourceId: context.sessionId, sourceLabel: context.label }],
	);
	getTruthyCampaignGraphValue(scene.notes, []).forEach((note, noteIndex) => {
		projectSceneNote(
			note,
			noteIndex,
			scene,
			sceneIndex,
			projection.id,
			projection.label,
			projection.name,
			context,
			commands,
		);
	});
	return projection.id;
}

interface SessionSceneProjection {
	id: string;
	name: string;
	label: string;
	summary: string;
	detailText: string;
	aliases: string[];
	meta: CampaignGraphNodeMeta;
	mentionSource: unknown;
}

function getTruthyCampaignGraphValue<T>(value: T | undefined, fallback: T): T {
	return value ? value : fallback;
}

function createSessionSceneProjection(
	scene: CampaignGraphRecord,
	sceneIndex: number,
	context: SessionGraphProjectionContext,
): SessionSceneProjection {
	const texts = getTruthyCampaignGraphValue(scene.texts, {});
	const name = `Scene ${sceneIndex + 1}`;
	return {
		id: `scene:${encodedPart(context.fileName)}:${encodedPart(scene.id ?? sceneIndex)}`,
		name,
		label: `${context.label}: ${name}`,
		summary: excerpt([texts.summary, texts.goal, texts.location, texts.stakes].filter(Boolean).join(" ")),
		detailText: Object.values(texts).filter(Boolean).join("\n\n"),
		aliases: [name, `${context.label} ${name}`],
		meta: {
			fileName: context.fileName,
			parentId: context.sessionId,
			sceneNumber: sceneIndex + 1,
		},
		mentionSource: getTruthyCampaignGraphValue(scene.texts, scene),
	};
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
	const fileName = getCampaignSessionFileName(session, index);
	const detail = getSessionDetail(input.sessionDetails, fileName);
	const sessionData = getCampaignSessionDetailData(detail);
	return {
		detail,
		sessionData,
		context: {
			fileName,
			sessionId: `session:${encodedPart(fileName)}`,
			label: getFirstTruthyCampaignGraphValue([
				session.name,
				getCampaignSessionDetailField(detail, "name"),
			], `Session ${index + 1}`),
			simplifiedNotes: Boolean(input.simplifiedNotes),
		},
	};
}

function getCampaignSessionFileName(
	session: CampaignGraphRecord,
	index: number,
): string {
	return session.fileName ? session.fileName : `session-${index}`;
}

function getCampaignSessionDetailField(
	detail: CampaignGraphRecord | null,
	field: string,
): unknown {
	return detail ? detail[field] : undefined;
}

function getCampaignSessionDetailData(
	detail: CampaignGraphRecord | null,
): CampaignGraphRecord {
	return getTruthyCampaignGraphValue(detail?.data, {});
}

function createCampaignSessionNode(
	session: CampaignGraphRecord,
	projection: CampaignSessionProjection,
): CampaignGraphNodeInput {
	const { context, detail, sessionData } = projection;
	const resultText = getTruthyCampaignGraphValue(sessionData.result_text, "");
	return {
		id: context.sessionId,
		type: "session",
		label: context.label,
		summary: excerpt(getFirstTruthyCampaignGraphValue([
			resultText,
			getCampaignSessionDetailField(detail, "name"),
			session.name,
		], undefined)),
		detailText: resultText,
		aliases: [session.name, getCampaignSessionDetailField(detail, "name"), context.fileName].filter(Boolean),
		sourceId: getFirstTruthyCampaignGraphValue([
			getCampaignSessionDetailField(detail, "id"),
			session.id,
		], undefined),
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
		getMentionsFromValue(getTruthyCampaignGraphValue(sessionData.result_text, ""), "result_text"),
		"session",
	);
	getTruthyCampaignGraphValue(sessionData.npcs, []).forEach((npc, npcIndex) =>
		projectSessionNpc(npc, npcIndex, context, commands),
	);
	getTruthyCampaignGraphValue(sessionData.locations, []).forEach((location, locationIndex) =>
		projectSessionLocation(location, locationIndex, context, commands),
	);
	getTruthyCampaignGraphValue(sessionData.notes, []).forEach((note, noteIndex) =>
		projectSessionNote(note, noteIndex, context, commands),
	);
	projectSessionScenes(getTruthyCampaignGraphValue(sessionData.scenes, []), context, commands);
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

interface CampaignGraphStores {
	nodesById: Map<string, CampaignGraphNode>;
	aliases: Map<string, string[]>;
	edgesById: Map<string, CampaignGraphEdge>;
}

function registerCampaignGraphAlias(
	stores: CampaignGraphStores,
	alias: unknown,
	nodeId: string,
): void {
	const key = normalizeGraphName(alias);
	if (!key) return;
	const current = stores.aliases.get(key) || [];
	current.push(nodeId);
	stores.aliases.set(key, current);
}

function createCampaignGraphNode(
	node: CampaignGraphNodeInput,
): CampaignGraphNode {
	const nextNode: CampaignGraphNode = {
		...node,
		label: String(node.label || "").trim() || "Untitled",
		meta: node.meta || {},
		searchText: "",
		degree: 0,
	};
	nextNode.searchText = buildNodeSearchText(nextNode);
	return nextNode;
}

function addCampaignGraphNode(
	stores: CampaignGraphStores,
	node: CampaignGraphNodeInput,
): CampaignGraphNode | undefined {
	if (!node.id || stores.nodesById.has(node.id)) return stores.nodesById.get(node.id);
	const nextNode = createCampaignGraphNode(node);
	stores.nodesById.set(nextNode.id, nextNode);
	getTruthyCampaignGraphValue(node.aliases, [nextNode.label])
		.forEach((alias) => registerCampaignGraphAlias(stores, alias, nextNode.id));
	return nextNode;
}

function getCampaignGraphEdgeEndpoints(
	source: string,
	target: string,
	relation: string,
): [string, string] {
	if (relation === "related" && source.localeCompare(target) > 0) return [target, source];
	return [source, target];
}

function appendCampaignGraphEdgeSource(
	edge: CampaignGraphEdge,
	sourceInfo: Record<string, unknown>,
): void {
	edge.count += 1;
	edge.sources.push(sourceInfo);
}

function addCampaignGraphEdge(
	stores: CampaignGraphStores,
	source: string | null | undefined,
	target: string | null | undefined,
	relation: string,
	sourceInfo: Record<string, unknown> = {},
): void {
	const validEndpoints = getValidCampaignGraphEdgeEndpoints(source, target);
	if (!validEndpoints) return;
	const [validSource, validTarget] = validEndpoints;
	const [edgeSource, edgeTarget] = getCampaignGraphEdgeEndpoints(validSource, validTarget, relation);
	const id = `${relation}:${edgeSource}->${edgeTarget}`;
	const current = stores.edgesById.get(id);
	if (current) {
		appendCampaignGraphEdgeSource(current, sourceInfo);
		return;
	}
	stores.edgesById.set(id, {
		id,
		source: edgeSource,
		target: edgeTarget,
		relation,
		count: 1,
		sources: [sourceInfo],
	});
}

function getValidCampaignGraphEdgeEndpoints(
	source: string | null | undefined,
	target: string | null | undefined,
): [string, string] | null {
	if (![Boolean(source), Boolean(target), source !== target].every(Boolean)) return null;
	return [source as string, target as string];
}

interface CampaignGraphRootContext {
	id: string;
	label: unknown;
}

function projectCampaignRoot(
	campaign: CampaignGraphRecord,
	description: unknown,
	context: CampaignGraphRootContext,
	commands: CampaignGraphProjectionCommands,
): void {
	commands.addNode({
		id: context.id,
		type: "campaign",
		label: getFirstTruthyCampaignGraphValue([context.label], "Campaign"),
		summary: excerpt(description),
		detailText: description,
		aliases: [campaign.name, campaign.slug].filter(Boolean),
		meta: { sourceSlug: campaign.slug },
	});
	commands.queueMentionEdges(
		context.id,
		context.label,
		getMentionsFromValue(description, "description"),
		"campaign",
	);
}

interface CampaignPersonProjectionOptions {
	type: "character" | "npc";
	fallback: string;
	containsField: "characters" | "npc";
	summaryValues: unknown[];
}

function projectCampaignPerson(
	entity: CampaignGraphRecord,
	index: number,
	options: CampaignPersonProjectionOptions,
	context: CampaignGraphRootContext,
	commands: CampaignGraphProjectionCommands,
): void {
	const label = getCharacterLabel(entity, `${options.fallback} ${index + 1}`);
	const entityId = `${options.type}:${encodedPart(entity.id ?? entity.slug ?? index)}`;
	commands.addNode({
		id: entityId,
		type: options.type,
		label,
		summary: excerpt(options.summaryValues.filter(Boolean).join(" ")),
		detailText: [entity.description, entity.motivation, entity.trait].filter(Boolean).join("\n\n"),
		aliases: [label, entity.firstName, entity.name, entity.title].filter(Boolean),
		sourceId: entity.id,
		sourceSlug: entity.slug,
		meta: { sourceSlug: entity.slug },
	});
	commands.addEdge(context.id, entityId, "contains", {
		type: "campaign",
		label: context.label,
		field: options.containsField,
	});
	commands.queueMentionEdges(
		entityId,
		label,
		getMentionsFromValue(entity, options.type),
		options.type,
	);
}

function projectCampaignLocation(
	location: CampaignGraphRecord,
	index: number,
	context: CampaignGraphRootContext,
	commands: CampaignGraphProjectionCommands,
): void {
	const label = getLocationLabel(location, `Location ${index + 1}`);
	const locationId = `location:${encodedPart(location.id ?? location.slug ?? index)}`;
	commands.addNode({
		id: locationId,
		type: "location",
		label,
		summary: excerpt(location.description),
		detailText: getTruthyCampaignGraphValue(location.description, ""),
		aliases: [label, location.name, location.title].filter(Boolean),
		sourceId: location.id,
		sourceSlug: location.slug,
		meta: { sourceSlug: location.slug },
	});
	commands.addEdge(context.id, locationId, "contains", {
		type: "campaign",
		label: context.label,
		field: "locations",
	});
	commands.queueMentionEdges(
		locationId,
		label,
		getMentionsFromValue(location, "location"),
		"location",
	);
}

function projectCampaignCollections(
	input: CampaignGraphInput,
	context: CampaignGraphRootContext,
	commands: CampaignGraphProjectionCommands,
): void {
	getTruthyCampaignGraphValue(input.notes, []).forEach((note, index) => {
		projectCampaignNote(note, index, context.id, context.label, Boolean(input.simplifiedNotes), commands);
	});
	getTruthyCampaignGraphValue(input.characters, []).forEach((character, index) => {
		projectCampaignPerson(character, index, {
			type: "character",
			fallback: "Character",
			containsField: "characters",
			summaryValues: [character.race, character.class, character.motivation, character.description, character.trait],
		}, context, commands);
	});
	getTruthyCampaignGraphValue(input.npcs, []).forEach((npc, index) => {
		projectCampaignPerson(npc, index, {
			type: "npc",
			fallback: "NPC",
			containsField: "npc",
			summaryValues: [npc.race, npc.class, npc.description, npc.motivation, npc.trait],
		}, context, commands);
	});
	getTruthyCampaignGraphValue(input.locations, []).forEach((location, index) => {
		projectCampaignLocation(location, index, context, commands);
	});
	getTruthyCampaignGraphValue(input.sessions, []).forEach((session, index) => {
		projectCampaignSession(
			session,
			index,
			{ sessionDetails: input.sessionDetails, simplifiedNotes: input.simplifiedNotes },
			context.id,
			context.label,
			commands,
		);
	});
}

type AddMentionEdges = (
	sourceId: string,
	sourceLabel: unknown,
	mentions: GraphMention[],
	sourceType: string,
	options?: { includeRelated?: boolean },
) => void;

function flushCampaignGraphMentionQueue(
	pendingMentionEdges: PendingMentionEdge[],
	addMentionEdges: AddMentionEdges,
): void {
	pendingMentionEdges.forEach((entry) => {
		addMentionEdges(entry.sourceId, entry.sourceLabel, entry.mentions, entry.sourceType);
		getTruthyCampaignGraphValue(entry.propagateTo, []).forEach((source) => {
			addMentionEdges(
				source.sourceId,
				source.sourceLabel,
				entry.mentions,
				entry.sourceType,
				{ includeRelated: false },
			);
		});
	});
}

function finalizeCampaignGraph(stores: CampaignGraphStores): CampaignGraphResult {
	const nodes = [...stores.nodesById.values()].map((node) => ({ ...node, degree: 0 }));
	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	const edges = [...stores.edgesById.values()].filter(
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
	const stores = { nodesById, aliases, edgesById };
	const campaignId = `campaign:${encodedPart(campaign.slug || "current")}`;
	const campaignSourceLabel = getCampaignSourceLabel(campaign);

	const addNode = (node: CampaignGraphNodeInput) => addCampaignGraphNode(stores, node);

	const addEdge = (
		source: string | null | undefined,
		target: string | null | undefined,
		relation: string,
		sourceInfo: Record<string, unknown> = {},
	): void => addCampaignGraphEdge(stores, source, target, relation, sourceInfo);

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

	const rootContext = { id: campaignId, label: campaignSourceLabel };
	projectCampaignRoot(campaign, description, rootContext, projectionCommands);
	projectCampaignCollections({ notes, characters, npcs, locations, sessions, sessionDetails, simplifiedNotes }, rootContext, projectionCommands);
	flushCampaignGraphMentionQueue(pendingMentionEdges, addMentionEdges);
	return finalizeCampaignGraph(stores);
}
