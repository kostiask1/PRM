import {
	useCallback,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";

import type { EntityModalProps } from "../../../../features/entity-link/index.js";
import { lang } from "../../../../shared/lib/index.js";
import type { SharedNote } from "../../../../shared/lib/index.js";
import type { CampaignGraphNode } from "../../graph.js";
import {
	executeCampaignGraphOpenTarget,
	getCampaignGraphNoteSaveRequest,
	getCampaignGraphOpenTarget,
} from "../../model/campaignGraphPresentation.ts";
import type {
	CampaignGraphNoteSave,
	CampaignPageEntity,
	CampaignSessionDetails,
} from "../../model/contracts.ts";
import type { CampaignPageRuntime } from "../../model/CampaignPageRuntime.tsx";
import { CampaignGraphNoteModal } from "./CampaignGraphNoteModal.tsx";

type CampaignGraphEntityModalState = NonNullable<EntityModalProps["modalState"]>;

interface UseCampaignGraphOpenActionsOptions {
	campaignSlug: string;
	characters: CampaignPageEntity[];
	npcs: CampaignPageEntity[];
	locations: CampaignPageEntity[];
	notes: SharedNote[];
	sessionDetails: CampaignSessionDetails;
	onSaveNote: (request: CampaignGraphNoteSave) => void | Promise<void>;
	onOpenSession: (fileName: string) => void;
	simplifiedNotes: boolean;
	openModal: CampaignPageRuntime["openModal"];
}

interface CampaignGraphOpenActions {
	entityModalState: CampaignGraphEntityModalState | null;
	setEntityModalState: Dispatch<SetStateAction<CampaignGraphEntityModalState | null>>;
	openNode: (node: CampaignGraphNode) => void;
}

export function useCampaignGraphOpenActions({
	campaignSlug,
	characters,
	npcs,
	locations,
	notes,
	sessionDetails,
	onSaveNote,
	onOpenSession,
	simplifiedNotes,
	openModal,
}: UseCampaignGraphOpenActionsOptions): CampaignGraphOpenActions {
	const [entityModalState, setEntityModalState] =
		useState<CampaignGraphEntityModalState | null>(null);

	const openGraphNote = useCallback(
		(node: CampaignGraphNode, note: SharedNote) => {
			if (typeof onSaveNote !== "function") return;
			openModal({
				title: lang.t("Note"),
				type: "note",
				showFooter: false,
				children: (
					<CampaignGraphNoteModal
						note={note}
						simplifiedNotes={simplifiedNotes}
						campaignSlug={campaignSlug}
						onSave={(updates) => {
							const request = getCampaignGraphNoteSaveRequest(node, updates);
							if (request) return onSaveNote(request);
						}}
					/>
				),
			});
		},
		[campaignSlug, onSaveNote, openModal, simplifiedNotes],
	);

	const openNode = useCallback(
		(node: CampaignGraphNode) => {
			const target = getCampaignGraphOpenTarget({
				node,
				characters,
				npcs,
				locations,
				notes,
				sessionDetails,
				canSaveNote: typeof onSaveNote === "function",
			});
			executeCampaignGraphOpenTarget(target, {
				session: (fileName) => onOpenSession?.(fileName),
				entity: (entity, type) => setEntityModalState({ entity, type }),
				note: (note) => openGraphNote(node, note),
			});
		},
		[
			characters,
			locations,
			notes,
			npcs,
			openGraphNote,
			onOpenSession,
			onSaveNote,
			sessionDetails,
		],
	);

	return { entityModalState, setEntityModalState, openNode };
}
