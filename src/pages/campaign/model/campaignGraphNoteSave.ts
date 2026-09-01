import type { SessionRecord } from "../../../entities/session/index.js";
import { upsertNoteById } from "../../../shared/lib/index.js";
import type { SharedNote } from "../../../shared/lib/index.js";
import type {
	CampaignGraphNoteSave,
	CampaignGraphScene,
	CampaignSessionDetail,
} from "./contracts.ts";

interface CampaignGraphNotePlanBase {
	noteId: string | number;
	updates: Partial<SharedNote>;
}

export type CampaignGraphNoteSavePlan =
	| { kind: "none" }
	| ({ kind: "campaign-note" } & CampaignGraphNotePlanBase)
	| ({ kind: "session-note"; fileName: string } & CampaignGraphNotePlanBase)
	| ({
			kind: "scene-note";
			fileName: string;
			sceneId: string | number;
	  } & CampaignGraphNotePlanBase);

export type CampaignGraphSessionNoteSavePlan = Extract<
	CampaignGraphNoteSavePlan,
	{ kind: "session-note" | "scene-note" }
>;

export type CampaignGraphSessionSaveOutcome =
	| "saved"
	| "missing-session"
	| "failed";

interface ExecuteCampaignGraphSessionNoteSaveOptions {
	campaignSlug: string;
	plan: CampaignGraphSessionNoteSavePlan;
	currentSession: CampaignSessionDetail | null | undefined;
	updateSession: (
		campaignSlug: string,
		fileName: string,
		payload: Pick<CampaignSessionDetail, "data">,
	) => Promise<SessionRecord | null>;
	onLocalUpdate: (fileName: string, session: CampaignSessionDetail) => void;
	onError: (error: unknown) => void;
}

function isResourceId(value: unknown): value is string | number {
	return typeof value === "string" || typeof value === "number";
}

function isNoteUpdates(value: unknown): value is Partial<SharedNote> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getCampaignGraphNoteSavePlan(
	request: CampaignGraphNoteSave,
): CampaignGraphNoteSavePlan {
	if (!isValidCampaignGraphNoteSaveRequest(request)) return { kind: "none" };
	const base = { noteId: request.noteId, updates: request.updates };
	const reader = CAMPAIGN_GRAPH_NOTE_SAVE_PLAN_READERS[request.nodeType]
		?? getCampaignGraphSceneNoteSavePlan;
	return reader(request, base);
}

function isValidCampaignGraphNoteSaveRequest(
	request: CampaignGraphNoteSave,
): request is CampaignGraphNoteSave & CampaignGraphNotePlanBase {
	return [isResourceId(request.noteId), isNoteUpdates(request.updates)].every(Boolean);
}

type CampaignGraphNoteSavePlanReader = (
	request: CampaignGraphNoteSave,
	base: CampaignGraphNotePlanBase,
) => CampaignGraphNoteSavePlan;

const getCampaignGraphCampaignNoteSavePlan: CampaignGraphNoteSavePlanReader = (_request, base) => ({
	kind: "campaign-note",
	...base,
});

const getCampaignGraphSessionNoteSavePlan: CampaignGraphNoteSavePlanReader = (request, base) => {
	if (!request.fileName) return { kind: "none" };
	return { kind: "session-note", fileName: request.fileName, ...base };
};

const getCampaignGraphSceneNoteSavePlan: CampaignGraphNoteSavePlanReader = (request, base) => {
	if (!request.fileName || !isResourceId(request.sceneId)) return { kind: "none" };
	return {
		kind: "scene-note",
		fileName: request.fileName,
		sceneId: request.sceneId,
		...base,
	};
};

const CAMPAIGN_GRAPH_NOTE_SAVE_PLAN_READERS: Readonly<
	Record<string, CampaignGraphNoteSavePlanReader>
> = {
	"campaign-note": getCampaignGraphCampaignNoteSavePlan,
	"session-note": getCampaignGraphSessionNoteSavePlan,
	"scene-note": getCampaignGraphSceneNoteSavePlan,
};

function updateExistingGraphNoteList(
	notes: SharedNote[] | undefined,
	noteId: string | number,
	updates: Partial<SharedNote>,
): SharedNote[] {
	return (Array.isArray(notes) ? notes : []).map((note) =>
		String(note.id) === String(noteId) ? { ...note, ...updates } : note,
	);
}

function updateGraphScene(
	scene: CampaignGraphScene,
	plan: Extract<CampaignGraphSessionNoteSavePlan, { kind: "scene-note" }>,
): CampaignGraphScene {
	if (String(scene.id) !== String(plan.sceneId)) return scene;
	return {
		...scene,
		notes: updateExistingGraphNoteList(scene.notes, plan.noteId, plan.updates),
	};
}

export function applyCampaignGraphSessionNoteSave(
	session: CampaignSessionDetail,
	plan: CampaignGraphSessionNoteSavePlan,
): CampaignSessionDetail {
	const data = session.data || {};
	if (plan.kind === "session-note") {
		return {
			...session,
			data: {
				...data,
				notes: updateExistingGraphNoteList(data.notes, plan.noteId, plan.updates),
			},
		};
	}
	const scenes = Array.isArray(data.scenes) ? data.scenes : [];
	return {
		...session,
		data: {
			...data,
			scenes: scenes.map((scene) => updateGraphScene(scene, plan)),
		},
	};
}

export function applyCampaignGraphCampaignNoteSave(
	notes: SharedNote[],
	plan: Extract<CampaignGraphNoteSavePlan, { kind: "campaign-note" }>,
): SharedNote[] {
	return upsertNoteById(notes, plan.noteId, plan.updates);
}

export async function executeCampaignGraphSessionNoteSave({
	campaignSlug,
	plan,
	currentSession,
	updateSession,
	onLocalUpdate,
	onError,
}: ExecuteCampaignGraphSessionNoteSaveOptions): Promise<CampaignGraphSessionSaveOutcome> {
	if (!currentSession) return "missing-session";
	const nextSession = applyCampaignGraphSessionNoteSave(currentSession, plan);
	onLocalUpdate(plan.fileName, nextSession);
	try {
		await updateSession(campaignSlug, plan.fileName, { data: nextSession.data });
		return "saved";
	} catch (error) {
		onError(error);
		return "failed";
	}
}
