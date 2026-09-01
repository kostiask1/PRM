const HISTORY_VERSION = 1;
const HISTORY_LIMIT = 100;

function clone(value) {
	if (value === undefined) return undefined;
	return JSON.parse(JSON.stringify(value));
}

function normalizeEntries(value) {
	return Array.isArray(value) ? value.slice(0, HISTORY_LIMIT) : [];
}

function normalizeRestoring(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	if (!value.transactionId || !["undo", "redo"].includes(value.direction)) {
		return null;
	}
	return {
		transactionId: String(value.transactionId),
		direction: value.direction,
		active: Number.isSafeInteger(value.active) && value.active >= 0
			? value.active
			: null,
		completed: Array.isArray(value.completed)
			? [...new Set(
				value.completed.filter(
					(index) => Number.isSafeInteger(index) && index >= 0,
				),
			)].sort((left, right) => left - right)
			: [],
	};
}

function normalizeHistory(value) {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		return {
			version: HISTORY_VERSION,
			revision: 0,
			limit: HISTORY_LIMIT,
			past: [],
			future: [],
			pending: null,
			restoring: null,
		};
	}
	if (value.version === undefined) {
		return normalizeHistory(null);
	}
	if (value.version !== HISTORY_VERSION) {
		const error = new Error("Unsupported change history version.");
		error.status = 409;
		throw error;
	}
	return {
		version: HISTORY_VERSION,
		revision: Number.isSafeInteger(value.revision) && value.revision >= 0
			? value.revision
			: 0,
		limit: HISTORY_LIMIT,
		past: normalizeEntries(value.past),
		future: normalizeEntries(value.future),
		pending:
			value.pending && typeof value.pending === "object"
				? clone(value.pending)
				: null,
		restoring: normalizeRestoring(value.restoring),
	};
}

function valuesEqual(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function getHistoryStatus(history) {
	const normalized = normalizeHistory(history);
	const undo = normalized.past[0] || null;
	const redo = normalized.future[0] || null;
	return {
		version: normalized.version,
		revision: normalized.revision,
		limit: normalized.limit,
		canUndo: Boolean(undo),
		canRedo: Boolean(redo),
		undo: undo ? transactionSummary(undo) : null,
		redo: redo ? transactionSummary(redo) : null,
		pending: normalized.pending
			? {
					id: normalized.pending.id,
					operation: normalized.pending.operation,
					startedAt: normalized.pending.startedAt,
				}
			: null,
		restoring: normalized.restoring ? clone(normalized.restoring) : null,
	};
}

function transactionSummary(transaction) {
	return {
		id: transaction.id,
		createdAt: transaction.createdAt,
		operation: transaction.operation,
		params: clone(transaction.params || {}),
		status: transaction.status || "committed",
		affected: clone(transaction.affected || {}),
	};
}

function beginHistoryTransaction(history, pending) {
	const normalized = normalizeHistory(history);
	if (normalized.restoring) {
		const error = new Error("Finish the pending history restoration first.");
		error.status = 409;
		throw error;
	}
	return {
		...normalized,
		pending: clone(pending),
	};
}

function commitHistoryTransaction(history, transaction) {
	const normalized = normalizeHistory(history);
	return {
		...normalized,
		revision: normalized.revision + 1,
		past: [clone(transaction), ...normalized.past].slice(0, HISTORY_LIMIT),
		future: [],
		pending: null,
		restoring: null,
	};
}

function clearPendingHistoryTransaction(history) {
	return { ...normalizeHistory(history), pending: null };
}

function prepareHistoryRestore(history, direction, expectedRevision) {
	const normalized = normalizeHistory(history);
	assertExpectedRevision(normalized, expectedRevision);
	const sourceKey = direction === "redo" ? "future" : "past";
	const transaction = normalized[sourceKey][0] || null;
	if (!transaction) return { history: normalized, transaction: null };
	if (
		normalized.restoring &&
		(
			normalized.restoring.transactionId !== String(transaction.id) ||
			normalized.restoring.direction !== direction
		)
	) {
		const error = new Error("A different history restoration is pending.");
		error.status = 409;
		throw error;
	}
	return {
		transaction: clone(transaction),
		history: normalized.restoring
			? normalized
			: {
				...normalized,
					restoring: {
						transactionId: String(transaction.id),
						direction,
						active: null,
						completed: [],
				},
			},
	};
}

function markHistoryRestoreActive(history, index) {
	const normalized = normalizeHistory(history);
	if (!normalized.restoring) {
		const error = new Error("No history restoration is pending.");
		error.status = 409;
		throw error;
	}
	return {
		...normalized,
		restoring: {
			...normalized.restoring,
			active: index,
		},
	};
}

function markHistoryRestoreChange(history, index) {
	const normalized = normalizeHistory(history);
	if (!normalized.restoring) {
		const error = new Error("No history restoration is pending.");
		error.status = 409;
		throw error;
	}
	return {
		...normalized,
		restoring: {
			...normalized.restoring,
			active: null,
			completed: [...new Set([
				...normalized.restoring.completed,
				index,
			])].sort((left, right) => left - right),
		},
	};
}

function assertExpectedRevision(history, expectedRevision) {
	if (
		expectedRevision === undefined ||
		expectedRevision === null ||
		Number(expectedRevision) === history.revision
	) {
		return;
	}
	const error = new Error("Change history has been updated. Reload and try again.");
	error.status = 409;
	throw error;
}

function createHistoryTransition(history, direction, expectedRevision) {
	const normalized = normalizeHistory(history);
	assertExpectedRevision(normalized, expectedRevision);
	const sourceKey = direction === "redo" ? "future" : "past";
	const targetKey = direction === "redo" ? "past" : "future";
	const transaction = normalized[sourceKey][0] || null;
	if (!transaction) return { history: normalized, transaction: null };
	return {
		transaction: clone(transaction),
			history: {
			...normalized,
			revision: normalized.revision + 1,
			[sourceKey]: normalized[sourceKey].slice(1),
			[targetKey]: [clone(transaction), ...normalized[targetKey]].slice(
				0,
				HISTORY_LIMIT,
			),
			pending: null,
			restoring: null,
		},
	};
}

module.exports = {
	HISTORY_LIMIT,
	HISTORY_VERSION,
	assertExpectedRevision,
	beginHistoryTransaction,
	clearPendingHistoryTransaction,
	commitHistoryTransaction,
	createHistoryTransition,
	getHistoryStatus,
	markHistoryRestoreActive,
	markHistoryRestoreChange,
	normalizeHistory,
	prepareHistoryRestore,
	transactionSummary,
	valuesEqual,
};
