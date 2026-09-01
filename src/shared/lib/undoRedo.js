function cloneHistorySnapshot(value) {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof structuredClone === "function") return structuredClone(value);
	return JSON.parse(JSON.stringify(value));
}

export function isHistoryShortcutEvent(event) {
	const isMod = Boolean(event?.ctrlKey || event?.metaKey);
	return isMod && (event.code === "KeyZ" || event.code === "KeyY");
}

export function shouldUseAppHistoryForEvent(event) {
	const target = event?.target;
	return Boolean(target?.closest?.("[data-app-history-shortcuts='true']"));
}

export function addUndoSnapshot(
	undoStack,
	snapshot,
	clone = cloneHistorySnapshot,
) {
	return [...(Array.isArray(undoStack) ? undoStack : []), clone(snapshot)];
}

export function clearRedoStack() {
	return [];
}

export function createUndoTransition({
	undoStack,
	redoStack,
	current,
	clone = cloneHistorySnapshot,
}) {
	const sourceUndoStack = Array.isArray(undoStack) ? undoStack : [];
	if (sourceUndoStack.length === 0) {
		return {
			target: null,
			undoStack: sourceUndoStack,
			redoStack: Array.isArray(redoStack) ? redoStack : [],
		};
	}

	const target = sourceUndoStack[sourceUndoStack.length - 1];
	return {
		target,
		undoStack: sourceUndoStack.slice(0, -1),
		redoStack:
			current === undefined || current === null
				? Array.isArray(redoStack)
					? redoStack
					: []
				: [...(Array.isArray(redoStack) ? redoStack : []), clone(current)],
	};
}

export function createRedoTransition({
	undoStack,
	redoStack,
	current,
	clone = cloneHistorySnapshot,
}) {
	const sourceRedoStack = Array.isArray(redoStack) ? redoStack : [];
	if (sourceRedoStack.length === 0) {
		return {
			target: null,
			undoStack: Array.isArray(undoStack) ? undoStack : [],
			redoStack: sourceRedoStack,
		};
	}

	const target = sourceRedoStack[sourceRedoStack.length - 1];
	return {
		target,
		undoStack:
			current === undefined || current === null
				? Array.isArray(undoStack)
					? undoStack
					: []
				: [...(Array.isArray(undoStack) ? undoStack : []), clone(current)],
		redoStack: sourceRedoStack.slice(0, -1),
	};
}
