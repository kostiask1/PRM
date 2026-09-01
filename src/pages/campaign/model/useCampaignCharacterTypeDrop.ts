import { useEffect } from "react";
import {
	getCampaignCharacterDropRequest,
	type CampaignCharacterDropPayload,
} from "./campaignPagePresentation.ts";

interface CampaignDragDropDetail {
	payload?: CampaignCharacterDropPayload;
	clientX: number;
	clientY: number;
}

interface UseCampaignCharacterTypeDropOptions {
	viewDependency: unknown;
	onCharacterTypeDrop: (
		request: NonNullable<ReturnType<typeof getCampaignCharacterDropRequest>>,
	) => void;
}

export function useCampaignCharacterTypeDrop({
	viewDependency,
	onCharacterTypeDrop,
}: UseCampaignCharacterTypeDropOptions): void {
	useEffect(() => {
		const handleCharacterDragDrop = (
			event: CustomEvent<CampaignDragDropDetail>,
		) => {
			const target = document.elementFromPoint(
				event.detail.clientX,
				event.detail.clientY,
			);
			const dropZone = target?.closest?.<HTMLElement>(
				"[data-character-drop-type]",
			);
			const targetType = dropZone?.dataset.characterDropType;
			const request = getCampaignCharacterDropRequest(
				event.detail?.payload,
				targetType,
			);
			if (request) onCharacterTypeDrop(request);
		};

		window.addEventListener(
			"prm-draggable-list-drop",
			handleCharacterDragDrop as EventListener,
		);
		return () => {
			window.removeEventListener(
				"prm-draggable-list-drop",
				handleCharacterDragDrop as EventListener,
			);
		};
	}, [viewDependency]);
}
