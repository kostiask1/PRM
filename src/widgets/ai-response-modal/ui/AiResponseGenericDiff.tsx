import type { ReactNode } from "react";

import { lang } from "../../../shared/lib/index.js";
import {
	formatFieldValue,
	getFieldValue,
	getPreviewFieldKeys,
	isObjectSnapshot,
	type PreviewResource,
} from "../model/aiResponseModal.ts";

interface AiResponseGenericDiffProps {
	getPreviewResourceClassName: (resource: PreviewResource) => string;
	renderNoteArrayDiff: (
		resource: PreviewResource,
		beforeNotes: unknown,
		afterNotes: unknown,
	) => ReactNode;
	renderPreviewResourceHeader: (resource: PreviewResource) => ReactNode;
	resource: PreviewResource;
}

function AiResponseSingleSnapshotFields({
	resource,
}: Pick<AiResponseGenericDiffProps, "resource">) {
	const snapshot = resource.before === null ? resource.after : resource.before;
	const keys = isObjectSnapshot(snapshot)
		? Object.keys(snapshot).filter(
				(key) => !["id", "slug", "source", "createdAt"].includes(key),
			)
		: ["value"];
	return (
		<div className="AiAssistantPanel__preview_stack">
			{keys.map((key) => (
				<div key={`${resource.id}-${key}`} className="AiAssistantPanel__preview_field">
					<div className="AiAssistantPanel__preview_field_label">{key}</div>
					<pre>{formatFieldValue(getFieldValue(snapshot, key))}</pre>
				</div>
			))}
		</div>
	);
}

function AiResponseChangedField({
	resource,
	field,
	renderNoteArrayDiff,
}: Pick<AiResponseGenericDiffProps, "resource" | "renderNoteArrayDiff"> & {
	field: string;
}) {
	const before = getFieldValue(resource.before, field);
	const after = getFieldValue(resource.after, field);
	if (field === "notes" && (Array.isArray(before) || Array.isArray(after))) {
		return renderNoteArrayDiff(resource, before, after);
	}
	return (
		<div className="AiAssistantPanel__preview_columns">
			<div className="AiAssistantPanel__preview_column">
				<div className="AiAssistantPanel__preview_column_title">{lang.t("Before")}</div>
				<pre className="is_removed">{formatFieldValue(before)}</pre>
			</div>
			<div className="AiAssistantPanel__preview_column">
				<div className="AiAssistantPanel__preview_column_title">{lang.t("After")}</div>
				<pre className="is_added">{formatFieldValue(after)}</pre>
			</div>
		</div>
	);
}

export default function AiResponseGenericDiff({
	getPreviewResourceClassName,
	renderNoteArrayDiff,
	renderPreviewResourceHeader,
	resource,
}: AiResponseGenericDiffProps) {
	const isSingleSnapshot = resource.before === null || resource.after === null;
	const fieldKeys = getPreviewFieldKeys(
		resource.before,
		resource.after,
		resource.fieldSummary,
	);
	return (
		<div className={getPreviewResourceClassName(resource)}>
			{renderPreviewResourceHeader(resource)}
			{isSingleSnapshot ? (
				<AiResponseSingleSnapshotFields resource={resource} />
			) : (
				fieldKeys.map((field) => (
					<div
						key={`${resource.id}-${field}`}
						className="AiAssistantPanel__preview_field"
					>
						<div className="AiAssistantPanel__preview_field_label">{field}</div>
						<AiResponseChangedField
							resource={resource}
							field={field}
							renderNoteArrayDiff={renderNoteArrayDiff}
						/>
					</div>
				))
			)}
		</div>
	);
}
