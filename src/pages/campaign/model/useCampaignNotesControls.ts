import { useState } from "react";
import type { SharedNote } from "../../../shared/lib/index.js";
import {
	getCampaignNotesViewModePlan,
	type CampaignNotesViewMode,
} from "./campaignPagePresentation.ts";
import type { CampaignPageCampaign } from "./contracts.ts";

interface UseCampaignNotesControlsOptions {
	notes: SharedNote[];
	isNotesCollapsed: boolean;
	onNotesReorder: (notes: SharedNote[]) => void;
	onFinishTrackedReorder: () => void;
	onSetNotesCollapsed: (collapsed: boolean) => void;
	onTriggerSave: (updates: Partial<CampaignPageCampaign>) => void;
}

export interface CampaignNotesControls {
	notesViewMode: CampaignNotesViewMode;
	setNotesViewMode: (mode: CampaignNotesViewMode) => void;
	handleNotesViewModeChange: (mode: CampaignNotesViewMode) => void;
	handleBulkNotesCollapse: (collapsed: boolean) => void;
	toggleCampaignNoteAiIgnored: (
		noteId: string | number,
		ignored: boolean,
	) => void;
}

export function useCampaignNotesControls({
	notes,
	isNotesCollapsed,
	onNotesReorder,
	onFinishTrackedReorder,
	onSetNotesCollapsed,
	onTriggerSave,
}: UseCampaignNotesControlsOptions): CampaignNotesControls {
	const [notesViewMode, setNotesViewMode] =
		useState<CampaignNotesViewMode>("list");

	const toggleCampaignNoteAiIgnored = (
		noteId: string | number,
		ignored: boolean,
	) => {
		onNotesReorder(
			notes.map((note) =>
				note.id === noteId ? { ...note, _aiIgnored: ignored } : note,
			),
		);
	};

	const handleNotesViewModeChange = (mode: CampaignNotesViewMode) => {
		const plan = getCampaignNotesViewModePlan(mode, isNotesCollapsed);
		setNotesViewMode(plan.viewMode);
		if (!plan.collapsePatch) return;
		onSetNotesCollapsed(plan.collapsePatch.isNotesCollapsed);
		onTriggerSave(plan.collapsePatch);
	};

	const handleBulkNotesCollapse = (collapsed: boolean) => {
		onNotesReorder(notes.map((note) => ({ ...note, collapsed })));
		onFinishTrackedReorder();
	};

	return {
		notesViewMode,
		setNotesViewMode,
		handleNotesViewModeChange,
		handleBulkNotesCollapse,
		toggleCampaignNoteAiIgnored,
	};
}
