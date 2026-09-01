export type SessionId = string | number;

export interface SessionRecord extends Record<string, unknown> {
	id?: SessionId;
	name: string;
	order?: number;
	data?: unknown;
	fileName?: string;
}

export interface SessionRepository {
	exists(campaignSlug: string, fileName: string): Promise<boolean>;
	list(campaignSlug: string): Promise<SessionRecord[]>;
	read(campaignSlug: string, fileName: string): Promise<SessionRecord>;
	write(
		campaignSlug: string,
		fileName: string,
		session: SessionRecord,
	): Promise<SessionRecord & { fileName: string }>;
	remove(campaignSlug: string, fileName: string): Promise<void>;
	rename(
		campaignSlug: string,
		oldFileName: string,
		newFileName: string,
	): Promise<void>;
	createId(): SessionId;
	sanitizeName(name: unknown): string;
	createDefault(name: string): SessionRecord;
	ensureUniqueFile(
		campaignSlug: string,
		name: string,
		currentFileName?: string,
	): Promise<string>;
}

export function createSessionRepositoryPort(
	implementation: SessionRepository,
): Readonly<SessionRepository>;
