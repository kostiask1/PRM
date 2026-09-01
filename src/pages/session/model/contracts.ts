import type {
	SessionEditorData,
	SessionEditorSession,
	SessionScene,
} from "../../../features/session-editor/index.js";
import type { SessionPageEntity } from "./sessionEntityModel.ts";

export interface SessionPageData extends SessionEditorData {
	npcs?: SessionPageEntity[];
	locations?: SessionPageEntity[];
	[key: string]: unknown;
}

export interface SessionPageSession extends SessionEditorSession {
	name?: string;
	fileName?: string;
	data?: SessionPageData;
}

export interface SessionSyncEvent extends Record<string, unknown> {
	version?: string | number | null;
	campaignSlug?: string;
	sessionFileName?: string | number;
	resource?: string;
}

export interface SessionLoadOptions {
	force?: boolean;
}

export interface SessionChecklistItem {
	id: string;
	label: string;
	note?: string;
}

export type SessionSceneRecord = SessionScene;
