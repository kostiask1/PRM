import type { SessionRecord } from "../../../entities/session/index.js";
import type { SessionEditorSession } from "./sessionMutations.ts";

export interface SessionSavePolicy {
	throwOnError: boolean;
	updateUi: boolean;
}

export interface SessionSavePolicyInput {
	throwOnError?: boolean;
	updateUi?: boolean;
}

export interface ExecuteSessionSaveOptions {
	campaignSlug: string;
	sessionId: string;
	session: SessionEditorSession;
	policy: SessionSavePolicy;
	updateSession: (
		campaignSlug: string,
		sessionId: string,
		session: SessionEditorSession,
	) => Promise<SessionRecord | null>;
	setSaving?: (isSaving: boolean) => void;
	onSessionRenamed?: (session: SessionRecord) => void;
	onSaveError?: (error: unknown) => void;
}

const ignoreSavingState = () => {};
const ignoreSessionRename = () => {};
const ignoreSaveError = () => {};

export function normalizeSessionSavePolicy(
	input: SessionSavePolicyInput = {},
): SessionSavePolicy {
	return {
		throwOnError: input.throwOnError === true,
		updateUi: input.updateUi !== false,
	};
}

export function shouldNotifySessionRename(
	result: SessionRecord | null,
	sessionId: string,
	updateUi: boolean,
): result is SessionRecord {
	return Boolean(
		updateUi &&
			result?.fileName &&
			result.fileName !== sessionId,
	);
}

function resolveSessionSaveFailure(
	error: unknown,
	throwOnError: boolean,
): null {
	if (throwOnError) throw error;
	return null;
}

export async function executeSessionSave({
	campaignSlug,
	sessionId,
	session,
	policy,
	updateSession,
	setSaving = ignoreSavingState,
	onSessionRenamed = ignoreSessionRename,
	onSaveError = ignoreSaveError,
}: ExecuteSessionSaveOptions): Promise<SessionRecord | null> {
	const updateSavingState = policy.updateUi ? setSaving : ignoreSavingState;
	updateSavingState(true);
	try {
		const result = await updateSession(campaignSlug, sessionId, session);
		if (shouldNotifySessionRename(result, sessionId, policy.updateUi)) {
			onSessionRenamed(result);
		}
		return result;
	} catch (error) {
		onSaveError(error);
		return resolveSessionSaveFailure(error, policy.throwOnError);
	} finally {
		updateSavingState(false);
	}
}
