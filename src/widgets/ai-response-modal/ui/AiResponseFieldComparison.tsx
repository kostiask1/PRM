import { lang } from "../../../shared/lib/index.js";
import { formatFieldValue, getFieldValue, getPreviewFieldKeys, isObjectSnapshot } from "../model/aiResponseModal.ts";
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

export function AiResponseValueComparison({ before, after }: { before: unknown; after: unknown }) {
	const beforeEmpty = before === null || before === undefined || before === "";
	const afterEmpty = after === null || after === undefined || after === "";
	const comparison = compareText(beforeEmpty ? "" : formatFieldValue(before), afterEmpty ? "" : formatFieldValue(after));
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

export function AiResponseFieldComparison({ before, after }: { before: unknown; after: unknown }) {
	const fields = getPreviewFieldKeys(before, after);
	const wholeSnapshot = !isObjectSnapshot(before) || !isObjectSnapshot(after);
	return (
		<div className="AiAssistantPanel__field_comparisons">
			{fields.map((field) => (
				<div className="AiAssistantPanel__preview_field" key={field}>
					<div className="AiAssistantPanel__preview_field_label">{getAiResponseFieldLabel(field)}</div>
					<AiResponseValueComparison before={getFieldValue(before, field, wholeSnapshot)} after={getFieldValue(after, field, wholeSnapshot)} />
				</div>
			))}
		</div>
	);
}

export function AiResponseSingleSnapshotComparison({ before, after }: { before: unknown; after: unknown }) {
	const snapshot = before === null ? after : before;
	const wholeSnapshot = !isObjectSnapshot(snapshot);
	const fields = isObjectSnapshot(snapshot)
		? Object.keys(snapshot).filter((key) => !["id", "slug", "source", "createdAt"].includes(key))
		: ["value"];
	return (
		<div className="AiAssistantPanel__field_comparisons">
			{fields.map((field) => (
				<div className="AiAssistantPanel__preview_field" key={field}>
					<div className="AiAssistantPanel__preview_field_label">{getAiResponseFieldLabel(field)}</div>
					<AiResponseValueComparison before={getFieldValue(before, field, wholeSnapshot)} after={getFieldValue(after, field, wholeSnapshot)} />
				</div>
			))}
		</div>
	);
}
