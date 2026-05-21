export function cloneHistorySnapshot(value) {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof structuredClone === "function") return structuredClone(value);
	return JSON.parse(JSON.stringify(value));
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

export function createDistinctUndoTransition({
	undoStack,
	redoStack,
	current,
	isEqual,
	clone = cloneHistorySnapshot,
}) {
	const sourceUndoStack = Array.isArray(undoStack) ? undoStack : [];
	const nextUndoStack = [...sourceUndoStack];
	let target = null;

	while (nextUndoStack.length > 0) {
		const candidate = nextUndoStack.pop();
		if (!isEqual(candidate, current)) {
			target = candidate;
			break;
		}
	}

	return {
		target,
		undoStack: nextUndoStack,
		redoStack: target
			? [clone(current), ...(Array.isArray(redoStack) ? redoStack : [])]
			: Array.isArray(redoStack)
				? redoStack
				: [],
	};
}

export function createDistinctRedoTransition({
	undoStack,
	redoStack,
	current,
	isEqual,
	clone = cloneHistorySnapshot,
}) {
	const sourceRedoStack = Array.isArray(redoStack) ? redoStack : [];
	const nextRedoStack = [...sourceRedoStack];
	let target = null;

	while (nextRedoStack.length > 0) {
		const candidate = nextRedoStack.shift();
		if (!isEqual(candidate, current)) {
			target = candidate;
			break;
		}
	}

	return {
		target,
		undoStack: target
			? [...(Array.isArray(undoStack) ? undoStack : []), clone(current)]
			: Array.isArray(undoStack)
				? undoStack
				: [],
		redoStack: nextRedoStack,
	};
}
