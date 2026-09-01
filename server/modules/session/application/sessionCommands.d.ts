import type {
	SessionRecord,
	SessionRepository,
} from "./ports/sessionRepository";

export interface SessionCommands {
	list(input: { campaignSlug: string }): Promise<SessionRecord[]>;
	create(input: {
		campaignSlug: string;
		payload?: { name?: unknown; data?: unknown };
	}): Promise<SessionRecord & { fileName: string }>;
	get(input: {
		campaignSlug: string;
		fileName: string;
	}): Promise<SessionRecord & { fileName: string }>;
	update(input: {
		campaignSlug: string;
		fileName: string;
		patch?: Partial<SessionRecord>;
	}): Promise<SessionRecord & { fileName: string }>;
	remove(input: { campaignSlug: string; fileName: string }): Promise<void>;
	reorder(input: {
		campaignSlug: string;
		orders: Record<string, number>;
	}): Promise<{ ok: true }>;
}

export function createSessionCommands(
	repository: SessionRepository,
	options?: { now?: () => Date },
): SessionCommands;
