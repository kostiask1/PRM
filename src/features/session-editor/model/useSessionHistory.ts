import {
	useCallback,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import {
	addUndoSnapshot,
	clearRedoStack,
	createDistinctRedoTransition,
	createDistinctUndoTransition,
} from "../../../shared/lib/index.js";
import type {
	SessionEditorData,
	SessionEditorSession,
} from "./sessionMutations.ts";
import type { ScheduleSessionSave } from "./useSessionPersistence.ts";

export interface SessionHistorySnapshot {
	data: SessionEditorData | undefined;
}

interface RecordDataChangeOptions {
	hasPendingSave?: boolean;
	instant?: boolean;
}

interface ExternalSessionReplacementOptions {
	discardPendingSave: () => void;
	normalizeSession: (session: unknown) => SessionEditorSession;
}

interface SessionHistoryOptions {
	session: SessionEditorSession | null;
	setSession: Dispatch<SetStateAction<SessionEditorSession | null>>;
	scheduleSave: ScheduleSessionSave;
}

export interface SessionHistory {
	handleRedo: () => void;
	handleUndo: () => void;
	recordDataChange: (
		currentData: SessionEditorData | undefined,
		nextData: SessionEditorData | undefined,
		options?: RecordDataChangeOptions,
	) => void;
	redoStack: SessionHistorySnapshot[];
	replaceFromExternalUpdate: (
		updatedSession: unknown,
		options: ExternalSessionReplacementOptions,
	) => void;
	resetHistory: () => void;
	undoStack: SessionHistorySnapshot[];
}

const sameData = (
	left: SessionHistorySnapshot,
	right: SessionHistorySnapshot,
): boolean => JSON.stringify(left?.data) === JSON.stringify(right?.data);

export function useSessionHistory({
	session,
	setSession,
	scheduleSave,
}: SessionHistoryOptions): SessionHistory {
	const [undoStack, setUndoStack] = useState<SessionHistorySnapshot[]>([]);
	const [redoStack, setRedoStack] = useState<SessionHistorySnapshot[]>([]);
	const isApplyingHistoryRef = useRef(false);

	const resetHistory = useCallback(() => {
		setUndoStack([]);
		setRedoStack([]);
	}, []);

	const recordDataChange = useCallback(
		(
			currentData: SessionEditorData | undefined,
			nextData: SessionEditorData | undefined,
			{ hasPendingSave = false, instant = false }: RecordDataChangeOptions = {},
		) => {
			if (
				isApplyingHistoryRef.current ||
				JSON.stringify(currentData) === JSON.stringify(nextData) ||
				(hasPendingSave && !instant)
			) {
				return;
			}
			setUndoStack((current) =>
				addUndoSnapshot(current, { data: currentData }),
			);
			setRedoStack(clearRedoStack<SessionHistorySnapshot>());
		},
		[],
	);

	const finishHistoryApplication = () => {
		setTimeout(() => {
			isApplyingHistoryRef.current = false;
		}, 0);
	};

	const applyTransition = useCallback(
		(transition: {
			target: SessionHistorySnapshot | null;
			undoStack: SessionHistorySnapshot[];
			redoStack: SessionHistorySnapshot[];
		}) => {
			if (!transition.target) return;
			isApplyingHistoryRef.current = true;
			setUndoStack(transition.undoStack);
			setRedoStack(transition.redoStack);
			setSession((current) => {
				if (!current) return current;
				const updated = { ...current, data: transition.target?.data };
				scheduleSave(updated, true);
				return updated;
			});
			finishHistoryApplication();
		},
		[scheduleSave, setSession],
	);

	const handleUndo = useCallback(() => {
		if (!session || undoStack.length === 0) return;
		applyTransition(
			createDistinctUndoTransition({
				undoStack,
				redoStack,
				current: { data: session.data },
				isEqual: sameData,
			}),
		);
	}, [applyTransition, redoStack, session, undoStack]);

	const handleRedo = useCallback(() => {
		if (!session || redoStack.length === 0) return;
		applyTransition(
			createDistinctRedoTransition({
				undoStack,
				redoStack,
				current: { data: session.data },
				isEqual: sameData,
			}),
		);
	}, [applyTransition, redoStack, session, undoStack]);

	const replaceFromExternalUpdate = useCallback(
		(
			updatedSession: unknown,
			{ discardPendingSave, normalizeSession }: ExternalSessionReplacementOptions,
		) => {
			if (!session) return;
			setUndoStack((current) =>
				addUndoSnapshot(current, { data: session.data }),
			);
			setRedoStack(clearRedoStack<SessionHistorySnapshot>());
			isApplyingHistoryRef.current = true;
			discardPendingSave();
			setSession(normalizeSession(updatedSession));
			finishHistoryApplication();
		},
		[session, setSession],
	);

	return {
		handleRedo,
		handleUndo,
		recordDataChange,
		redoStack,
		replaceFromExternalUpdate,
		resetHistory,
		undoStack,
	};
}
