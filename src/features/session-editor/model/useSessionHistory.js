import { useCallback, useRef, useState } from "react";

import {
	addUndoSnapshot,
	clearRedoStack,
	createDistinctRedoTransition,
	createDistinctUndoTransition,
} from "../../../shared/lib/index.js";

const sameData = (left, right) =>
	JSON.stringify(left?.data) === JSON.stringify(right?.data);

export function useSessionHistory({ session, setSession, scheduleSave }) {
	const [undoStack, setUndoStack] = useState([]);
	const [redoStack, setRedoStack] = useState([]);
	const isApplyingHistoryRef = useRef(false);

	const resetHistory = useCallback(() => {
		setUndoStack([]);
		setRedoStack([]);
	}, []);

	const recordDataChange = useCallback(
		(currentData, nextData, { hasPendingSave = false, instant = false } = {}) => {
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
			setRedoStack(clearRedoStack());
		},
		[],
	);

	const finishHistoryApplication = () => {
		setTimeout(() => {
			isApplyingHistoryRef.current = false;
		}, 0);
	};

	const handleUndo = useCallback(() => {
		if (!session || undoStack.length === 0) return;
		const transition = createDistinctUndoTransition({
			undoStack,
			redoStack,
			current: { data: session.data },
			isEqual: sameData,
		});
		if (!transition.target) return;
		isApplyingHistoryRef.current = true;
		setRedoStack(transition.redoStack);
		setUndoStack(transition.undoStack);
		setSession((current) => {
			const updated = { ...current, data: transition.target.data };
			scheduleSave(updated, true);
			return updated;
		});
		finishHistoryApplication();
	}, [redoStack, scheduleSave, session, setSession, undoStack]);

	const handleRedo = useCallback(() => {
		if (!session || redoStack.length === 0) return;
		const transition = createDistinctRedoTransition({
			undoStack,
			redoStack,
			current: { data: session.data },
			isEqual: sameData,
		});
		if (!transition.target) return;
		isApplyingHistoryRef.current = true;
		setUndoStack(transition.undoStack);
		setRedoStack(transition.redoStack);
		setSession((current) => {
			const updated = { ...current, data: transition.target.data };
			scheduleSave(updated, true);
			return updated;
		});
		finishHistoryApplication();
	}, [redoStack, scheduleSave, session, setSession, undoStack]);

	const replaceFromExternalUpdate = useCallback(
		(updatedSession, { discardPendingSave, normalizeSession }) => {
			if (!session) return;
			setUndoStack((current) =>
				addUndoSnapshot(current, { data: session.data }),
			);
			setRedoStack(clearRedoStack());
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
