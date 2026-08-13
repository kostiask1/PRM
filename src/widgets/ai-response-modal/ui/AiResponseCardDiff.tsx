import type { ReactNode } from "react";

import { classNames, lang } from "../../../shared/lib/index.js";
import {
	buildCardHighlightFields,
	isResourceApplied,
	type CardHighlightFields,
	type PreviewResource,
} from "../model/aiResponseModal.ts";

type RenderEntityCard = (
	resource: PreviewResource,
	snapshot: unknown,
	editable?: boolean,
	highlightFields?: CardHighlightFields | null,
) => ReactNode;

interface AiResponseCardDiffProps {
	isDraft: boolean;
	renderEntityCard: RenderEntityCard;
	resource: PreviewResource;
}

function getSingleCardSurfaceClassName(isDraft: boolean, isNew: boolean): string {
	return classNames(
		"AiAssistant__preview_card_surface",
		isDraft && isNew && "is_editable",
	);
}

function isSingleCardEditable(
	isDraft: boolean,
	isNew: boolean,
	resource: PreviewResource,
): boolean {
	return isDraft && isNew && !isResourceApplied(resource);
}

function getSingleCardHighlightFields(
	isNew: boolean,
	snapshot: unknown,
): CardHighlightFields | null {
	return isNew
		? buildCardHighlightFields({ before: {}, after: snapshot })
		: null;
}

function AiResponseSingleCardDiff({
	isDraft,
	resource,
	renderEntityCard,
	isNew,
}: AiResponseCardDiffProps & {
	isNew: boolean;
}) {
	const snapshot = isNew ? resource.after : resource.before;
	return (
		<div className="AiAssistant__preview_card_stack">
			<div className="AiAssistant__preview_card_frame">
				<div className="AiAssistant__preview_column_title">
					{isNew ? lang.t("New") : lang.t("Deleted")}
				</div>
				<div
					className={getSingleCardSurfaceClassName(isDraft, isNew)}
				>
					{renderEntityCard(
						resource,
						snapshot,
						isSingleCardEditable(isDraft, isNew, resource),
						getSingleCardHighlightFields(isNew, snapshot),
					)}
				</div>
			</div>
		</div>
	);
}

function AiResponseChangedCardDiff({
	isDraft,
	resource,
	renderEntityCard,
}: AiResponseCardDiffProps) {
	const highlightFields = buildCardHighlightFields(resource);
	return (
		<div className="AiAssistant__preview_card_columns">
			<div className="AiAssistant__preview_card_frame">
				<div className="AiAssistant__preview_column_title">{lang.t("Before")}</div>
				<div className="AiAssistant__preview_card_surface is_before">
					{renderEntityCard(resource, resource.before, false, highlightFields)}
				</div>
			</div>
			<div className="AiAssistant__preview_card_frame">
				<div className="AiAssistant__preview_column_title">{lang.t("After")}</div>
				<div
					className={classNames(
						"AiAssistant__preview_card_surface is_after",
						isDraft && "is_editable",
					)}
				>
					{renderEntityCard(
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

export default function AiResponseCardDiff({
	isDraft,
	resource,
	renderEntityCard,
}: AiResponseCardDiffProps) {
	const isNew = resource.before === null;
	return isNew || resource.after === null ? (
		<AiResponseSingleCardDiff
			isDraft={isDraft}
			resource={resource}
			renderEntityCard={renderEntityCard}
			isNew={isNew}
		/>
	) : (
		<AiResponseChangedCardDiff
			isDraft={isDraft}
			resource={resource}
			renderEntityCard={renderEntityCard}
		/>
	);
}
