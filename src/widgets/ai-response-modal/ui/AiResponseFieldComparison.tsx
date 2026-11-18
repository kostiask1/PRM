import type { ReactNode } from "react";

import { lang } from "../../../shared/lib/index.js";
import {
	formatComparisonFieldValue,
	getFieldValue,
	getPreviewFieldKeys,
	isFieldEmpty,
	isObjectSnapshot,
	PREVIEW_IGNORED_KEYS,
} from "../model/aiResponseModal.ts";
import { compareText, type ComparedTextPart } from "../model/compareText.ts";
import { getAiResponseFieldLabel } from "./aiResponseFieldLabel.ts";

function ComparedValue({ parts, kind }: { parts: ComparedTextPart[]; kind: "removed" | "added" }) {
	return (
		<pre className={`AiAssistantPanel__compared_value is_${kind}`}>
			{parts.map((part, index) => part.changed
				? <mark key={index} className={`AiAssistantPanel__compared_change is_${kind}`}>{part.text}</mark>
				: <span key={index}>{part.text}</span>)}
		</pre>
	);
}

export function AiResponseValueComparison({ before, after, field }: { before: unknown; after: unknown; field?: string }) {
	const beforeEmpty = before === null || before === undefined || before === "";
	const afterEmpty = after === null || after === undefined || after === "";
	const comparison = compareText(beforeEmpty ? "" : formatComparisonFieldValue(field, before), afterEmpty ? "" : formatComparisonFieldValue(field, after));
	const beforeParts = beforeEmpty
		? [{ text: "—", changed: false }]
		: comparison.before;
	const afterParts = afterEmpty
		? [{ text: "—", changed: false }]
		: comparison.after;
	return (
		<div className="AiAssistantPanel__preview_columns">
			<div className="AiAssistantPanel__preview_column">
				<div className="AiAssistantPanel__preview_column_title">− {lang.t("Before")}</div>
				<ComparedValue parts={beforeParts} kind="removed" />
			</div>
			<div className="AiAssistantPanel__preview_column">
				<div className="AiAssistantPanel__preview_column_title">+ {lang.t("After")}</div>
				<ComparedValue parts={afterParts} kind="added" />
			</div>
		</div>
	);
}

type RenderNotes = (before: unknown, after: unknown) => ReactNode;

function FieldComparisonValue({ field, before, after, wholeSnapshot, renderNotes }: { field: string; before: unknown; after: unknown; wholeSnapshot: boolean; renderNotes?: RenderNotes }) {
	const previous = getFieldValue(before, field, wholeSnapshot);
	const next = getFieldValue(after, field, wholeSnapshot);
	if (!wholeSnapshot && field === "notes" && renderNotes && (Array.isArray(previous) || Array.isArray(next))) {
		return renderNotes(previous, next);
	}
	return <AiResponseValueComparison field={wholeSnapshot ? undefined : field} before={previous} after={next} />;
}

export function AiResponseFieldComparison({ before, after, renderNotes }: { before: unknown; after: unknown; renderNotes?: RenderNotes }) {
	const fields = getPreviewFieldKeys(before, after);
	const wholeSnapshot = !isObjectSnapshot(before) || !isObjectSnapshot(after);
	return (
		<div className="AiAssistantPanel__field_comparisons">
			{fields.map((field) => (
				<div className="AiAssistantPanel__preview_field" key={field}>
					<div className="AiAssistantPanel__preview_field_label">{getAiResponseFieldLabel(field)}</div>
					<FieldComparisonValue field={field} before={before} after={after} wholeSnapshot={wholeSnapshot} renderNotes={renderNotes} />
				</div>
			))}
		</div>
	);
}

export function AiResponseSingleSnapshotComparison({ before, after, renderNotes, ignoredFields = [] }: { before: unknown; after: unknown; renderNotes?: RenderNotes; ignoredFields?: readonly string[] }) {
	const snapshot = before === null ? after : before;
	const wholeSnapshot = !isObjectSnapshot(snapshot);
	const fields = isObjectSnapshot(snapshot)
		? Object.keys(snapshot).filter(
				(key) =>
					!PREVIEW_IGNORED_KEYS.has(key) &&
					!ignoredFields.includes(key) &&
					!isFieldEmpty(snapshot[key]),
		  )
		: ["value"];
	return (
		<div className="AiAssistantPanel__field_comparisons">
			{fields.map((field) => (
				<div className="AiAssistantPanel__preview_field" key={field}>
					<div className="AiAssistantPanel__preview_field_label">{getAiResponseFieldLabel(field)}</div>
					<FieldComparisonValue field={field} before={before} after={after} wholeSnapshot={wholeSnapshot} renderNotes={renderNotes} />
				</div>
			))}
		</div>
	);
}
