import type { ReactNode } from "react";

import { classNames, lang } from "../../../shared/lib/index.js";
import {
	buildNoteHighlightFields,
	isResourceApplied,
	type PreviewResource,
} from "../model/aiResponseModal.ts";

type RenderNoteCard = (
	resource: PreviewResource,
	note: unknown,
	editable?: boolean,
	highlightFields?: readonly string[] | null,
) => ReactNode;

type GetPreviewResourceClassName = (
	resource: PreviewResource,
	...extraClassNames: Array<string | false | null | undefined>
) => string;

interface AiResponseNoteDiffProps {
	getPreviewResourceClassName: GetPreviewResourceClassName;
	isDraft: boolean;
	renderNoteCard: RenderNoteCard;
	renderPreviewResourceHeader: (resource: PreviewResource) => ReactNode;
	resource: PreviewResource;
}

function getSingleNoteSurfaceClassName(
	isDraft: boolean,
	isNew: boolean,
): string {
	return classNames(
		"AiAssistantPanel__preview_note_surface",
		isDraft && isNew && "is_editable",
	);
}

function isSingleNoteEditable(
	isDraft: boolean,
	isNew: boolean,
	resource: PreviewResource,
): boolean {
	return isDraft && isNew && !isResourceApplied(resource);
}

function getSingleNoteHighlightFields(
	isNew: boolean,
): readonly string[] | null {
	return isNew ? ["title", "text"] : null;
}

function AiResponseSingleNoteDiff({
	isDraft,
	renderNoteCard,
	resource,
	isNew,
}: Pick<AiResponseNoteDiffProps, "isDraft" | "renderNoteCard" | "resource"> & {
	isNew: boolean;
}) {
	return (
		<div className="AiAssistantPanel__preview_card_stack">
			<div className="AiAssistantPanel__preview_card_frame">
				<div className="AiAssistantPanel__preview_column_title">
					{isNew ? lang.t("New") : lang.t("Deleted")}
				</div>
				<div className={getSingleNoteSurfaceClassName(isDraft, isNew)}>
					{renderNoteCard(
						resource,
						isNew ? resource.after : resource.before,
						isSingleNoteEditable(isDraft, isNew, resource),
						getSingleNoteHighlightFields(isNew),
					)}
				</div>
			</div>
		</div>
	);
}

function AiResponseChangedNoteDiff({
	isDraft,
	renderNoteCard,
	resource,
}: Pick<AiResponseNoteDiffProps, "isDraft" | "renderNoteCard" | "resource">) {
	const highlightFields = buildNoteHighlightFields(resource);
	return (
		<div className="AiAssistantPanel__preview_card_columns">
			<div className="AiAssistantPanel__preview_card_frame">
				<div className="AiAssistantPanel__preview_column_title">{lang.t("Before")}</div>
				<div className="AiAssistantPanel__preview_note_surface is_before">
					{renderNoteCard(resource, resource.before, false, highlightFields)}
				</div>
			</div>
			<div className="AiAssistantPanel__preview_card_frame">
				<div className="AiAssistantPanel__preview_column_title">{lang.t("After")}</div>
				<div
					className={classNames(
						"AiAssistantPanel__preview_note_surface is_after",
						isDraft && "is_editable",
					)}
				>
					{renderNoteCard(
						resource,
						resource.after,
						isDraft && !isResourceApplied(resource),
						highlightFields,
					)}
				</div>
			</div>
		</div>
	);
}

export default function AiResponseNoteDiff({
	getPreviewResourceClassName,
	isDraft,
	renderNoteCard,
	renderPreviewResourceHeader,
	resource,
}: AiResponseNoteDiffProps) {
	const isNew = resource.before === null;
	const isDeleted = resource.after === null;
	return (
		<div
			className={getPreviewResourceClassName(
				resource,
				"AiAssistantPanel__preview_resource_notes",
			)}
		>
			{renderPreviewResourceHeader(resource)}
			{isNew || isDeleted ? (
				<AiResponseSingleNoteDiff
					isDraft={isDraft}
					renderNoteCard={renderNoteCard}
					resource={resource}
					isNew={isNew}
				/>
			) : (
				<AiResponseChangedNoteDiff
					isDraft={isDraft}
					renderNoteCard={renderNoteCard}
					resource={resource}
				/>
			)}
		</div>
	);
}
