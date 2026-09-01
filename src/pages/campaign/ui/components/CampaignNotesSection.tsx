import { Button, CollapseToggleButton, DraggableList } from "../../../../shared/ui/index.js";
import "../../../../assets/components/CampaignNotesSection.css";
import {
	BulkCollapseButton,
	createNoteCardComponent,
	getAiIgnoredNoteListProps,
} from "../../../../features/notes/ui/index.js";
import { EditableField } from "../../../../features/editor/ui/index.js";
import { renderMentionText } from "../../../../features/entity-link/index.js";
import type { DomainId } from "../../../../entities/campaign/index.js";
import { makeHistoryTargetId } from "../../../../entities/history/index.js";
import {
	getNotesForRender,
	lang,
	makeDomId,
} from "../../../../shared/lib/index.js";
import type { CampaignPageCampaign } from "../../model/contracts.ts";
import type useCampaignView from "../../model/useCampaignView.ts";
import { useCampaignPageRuntime } from "../../model/CampaignPageRuntime.tsx";
import {
	getCampaignNotesCollapsePatch,
	getCampaignNotesSectionPresentation,
	normalizeCampaignCardNote,
	type CampaignNotesSectionPresentation,
	type CampaignNotesViewMode,
} from "../../model/campaignPagePresentation.ts";
import CampaignNotesGraph from "./CampaignNotesGraph.tsx";

const CampaignNoteCard = createNoteCardComponent({
	EditableField,
	renderMentionText,
});

type CampaignViewController = ReturnType<typeof useCampaignView>;
type CampaignRenderableNote = ReturnType<typeof getNotesForRender>[number];

interface CampaignNotesListProps {
	campaignSlug: string;
	view: CampaignViewController;
	notes: CampaignRenderableNote[];
	onToggleIgnored: (noteId: DomainId, ignored: boolean) => void;
}

function CampaignNotesList({
	campaignSlug,
	view,
	notes,
	onToggleIgnored,
}: CampaignNotesListProps) {
	return (
		<DraggableList
			items={notes}
			className="CampaignNotesSection__list"
			onReorder={view.handleNotesReorder}
			onDrop={view.finishTrackedReorder}
			{...getAiIgnoredNoteListProps(onToggleIgnored, {
				isolateDragEvents: false,
			})}
			renderItem={(note, _isDragging, index) => (
				<div
					id={makeDomId("campaign", "note", note.id)}
					data-history-focus-id={makeHistoryTargetId(
						"campaign",
						"note",
						note.id,
					)}
				>
					<CampaignNoteCard
						note={normalizeCampaignCardNote(note)}
						isLast={index === notes.length - 1}
						campaignSlug={campaignSlug}
						enableHistory={false}
						onToggleCollapse={view.handleToggleNoteCollapse}
						onTitleChange={view.handleNoteTitleChange}
						onTextChange={view.handleNoteChange}
						onDelete={view.handleDeleteNote}
					/>
				</div>
			)}
		/>
	);
}

interface CampaignNotesViewToggleProps {
	presentation: CampaignNotesSectionPresentation;
	items: CampaignViewController["notes"];
	onViewModeChange: (mode: CampaignNotesViewMode) => void;
	onBulkCollapse: (collapsed: boolean) => void;
}

function CampaignNotesViewToggle({
	presentation,
	items,
	onViewModeChange,
	onBulkCollapse,
}: CampaignNotesViewToggleProps) {
	return (
		<div className="CampaignNotesSection__viewToggle">
			{presentation.showBulkCollapse && (
				<BulkCollapseButton items={items} onChange={onBulkCollapse} />
			)}
			<Button
				variant={presentation.listButtonVariant}
				size={Button.SIZES.SMALL}
				icon="list"
				iconSize={16}
				onClick={() => onViewModeChange("list")}
				title={lang.t("List view")}
			>
				{lang.t("List")}
			</Button>
			<Button
				variant={presentation.graphButtonVariant}
				size={Button.SIZES.SMALL}
				icon="notes-graph"
				iconSize={16}
				onClick={() => onViewModeChange("graph")}
				title={lang.t("Graph view")}
			>
				{lang.t("Graph")}
			</Button>
		</div>
	);
}

interface CampaignNotesContentProps {
	campaign: CampaignPageCampaign;
	view: CampaignViewController;
	notes: CampaignRenderableNote[];
	presentation: CampaignNotesSectionPresentation;
	onToggleIgnored: (noteId: DomainId, ignored: boolean) => void;
}

function CampaignNotesContent({
	campaign,
	view,
	notes,
	presentation,
	onToggleIgnored,
}: CampaignNotesContentProps) {
	const { navigateToSession } = useCampaignPageRuntime();
	return (
		<>
			{presentation.isListVisible && (
				<CampaignNotesList
					campaignSlug={campaign.slug}
					view={view}
					notes={notes}
					onToggleIgnored={onToggleIgnored}
				/>
			)}
			{presentation.isGraphVisible && (
				<CampaignNotesGraph
					campaign={campaign}
					description={view.description}
					notes={view.notes}
					characters={view.characters}
					npcs={view.npcs}
					locations={view.locations}
					sessions={view.sessions}
					sessionDetails={view.sessionDetails}
					isLoading={view.isGraphDataLoading}
					error={view.graphDataError}
					onLoadSessionDetails={view.loadSessionDetailsForGraph}
					onSaveNote={view.handleGraphNoteSave}
					onOpenSession={(fileName) =>
						navigateToSession(campaign.slug, fileName)
					}
				/>
			)}
		</>
	);
}

interface CampaignNotesSectionProps {
	campaign: CampaignPageCampaign;
	view: CampaignViewController;
	notes: CampaignRenderableNote[];
	hasData: boolean;
	isCollapsed: boolean;
	viewMode: CampaignNotesViewMode;
	onViewModeChange: (mode: CampaignNotesViewMode) => void;
	onBulkCollapse: (collapsed: boolean) => void;
	onToggleIgnored: (noteId: DomainId, ignored: boolean) => void;
}

export default function CampaignNotesSection({
	campaign,
	view,
	notes,
	hasData,
	isCollapsed,
	viewMode,
	onViewModeChange,
	onBulkCollapse,
	onToggleIgnored,
}: CampaignNotesSectionProps) {
	const presentation = getCampaignNotesSectionPresentation({
		hasData,
		isCollapsed,
		viewMode,
	});
	const toggle = () => {
		const patch = getCampaignNotesCollapsePatch(hasData, isCollapsed);
		if (!patch) return;
		view.setIsNotesCollapsed(patch.isNotesCollapsed);
		view.triggerSave(patch);
	};
	return (
		<div
			id={makeDomId("campaign", "notes")}
			className="CampaignNotesSection"
			data-history-focus-id={makeHistoryTargetId("campaign", "notes")}
		>
			<div className="CampaignNotesSection__row">
				<div className="CampaignNotesSection__titleGroup" onClick={toggle}>
					{presentation.canToggleCollapse && (
						<CollapseToggleButton
							size={Button.SIZES.MEDIUM}
							collapsed={isCollapsed}
							onClick={toggle}
						/>
					)}
					<h3>{lang.t("Notes")}</h3>
				</div>
				<CampaignNotesViewToggle
					presentation={presentation}
					items={view.notes}
					onViewModeChange={onViewModeChange}
					onBulkCollapse={onBulkCollapse}
				/>
			</div>
			<CampaignNotesContent
				campaign={campaign}
				view={view}
				notes={notes}
				presentation={presentation}
				onToggleIgnored={onToggleIgnored}
			/>
		</div>
	);
}
