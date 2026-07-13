import type {
	SessionId,
	SessionRecord,
	SessionRepository,
} from "../application/ports/sessionRepository";

export interface SessionStorageAdapter {
	sessionPath(campaignSlug: string, fileName: string): string;
	exists(path: string): Promise<boolean>;
	listSessions(campaignSlug: string): Promise<SessionRecord[]>;
	readSession(campaignSlug: string, fileName: string): Promise<SessionRecord>;
	writeJson(path: string, session: SessionRecord): Promise<void>;
	renameWithRetry(sourcePath: string, targetPath: string): Promise<void>;
	createId(): SessionId;
	sanitizeName(name: unknown): string;
	makeDefaultSessionData(name: string): SessionRecord;
	ensureUniqueSessionFile(
		campaignSlug: string,
		name: string,
		currentFileName?: string,
	): Promise<string>;
}

export function createFileSessionRepository(
	storage: SessionStorageAdapter,
): Readonly<SessionRepository>;
