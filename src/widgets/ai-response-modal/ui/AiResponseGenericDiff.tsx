import type { ReactNode } from "react";

import {
	getFieldValue,
	getPreviewFieldKeys,
	isObjectSnapshot,
	type PreviewResource,
} from "../model/aiResponseModal.ts";
import { AiResponseSingleSnapshotComparison, AiResponseValueComparison } from "./AiResponseFieldComparison.tsx";
import { getAiResponseFieldLabel } from "./aiResponseFieldLabel.ts";

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
	return <AiResponseSingleSnapshotComparison before={resource.before} after={resource.after} />;
}

function AiResponseChangedField({
	resource,
	field,
	renderNoteArrayDiff,
}: Pick<AiResponseGenericDiffProps, "resource" | "renderNoteArrayDiff"> & {
	field: string;
}) {
	const wholeSnapshot = !isObjectSnapshot(resource.before) || !isObjectSnapshot(resource.after);
	const before = getFieldValue(resource.before, field, wholeSnapshot);
	const after = getFieldValue(resource.after, field, wholeSnapshot);
	if (field === "notes" && (Array.isArray(before) || Array.isArray(after))) {
		return renderNoteArrayDiff(resource, before, after);
	}
	return <AiResponseValueComparison field={wholeSnapshot ? undefined : field} before={before} after={after} />;
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
						<div className="AiAssistantPanel__preview_field_label">{getAiResponseFieldLabel(field)}</div>
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
