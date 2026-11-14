import { useRef } from "react";
import { Button, DraggableList, useHashItemSelection } from "../../../../shared/ui/index.js";
import "../../../../assets/components/CampaignNotesSection.css";
import "../../../../assets/components/CampaignEntitySection.css";
import {
	createNoteCardComponent,
	getAiIgnoredNoteListProps,
} from "../../../../features/notes/ui/index.js";
import { EditableField } from "../../../../features/editor/ui/index.js";
import { EntityLinkedListItem, renderMentionText } from "../../../../features/entity-link/index.js";
import type { DomainId } from "../../../../entities/campaign/index.js";
import { makeHistoryTargetId, matchesHistoryTargetId } from "../../../../entities/history/index.js";
import {
	getNotesForRender,
	getNoteListLabel,
	getNoteListPreview,
	lang,
	makeDomId,
} from "../../../../shared/lib/index.js";
import type { CampaignPageCampaign } from "../../model/contracts.ts";
import type useCampaignView from "../../model/useCampaignView.ts";
import { useCampaignPageRuntime } from "../../model/CampaignPageRuntime.tsx";
import {
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
	const detailRef = useRef<HTMLDivElement>(null);
	const { selected, setSelectedKey } = useHashItemSelection(notes, (note) => String(note.id), (note, hash) => matchesHistoryTargetId(hash, "campaign", "note", note.id) || hash === `#${makeDomId("campaign", "note", note.id)}`, (note, key) => note._renderKey != null && String(note._renderKey) === key);
	return (
		<div className="CampaignEntitySection__workspace">
		<DraggableList
			items={notes}
			className="CampaignNotesSection__list NoteSelectionList"
			keyboardReorder
			getKeyboardReorderLabel={(note) => lang.t("Reorder note: {name} (arrow keys)", { name: getNoteListLabel(note) || lang.t("New note") })}
			onReorder={view.handleNotesReorder}
			onDrop={view.finishTrackedReorder}
			{...getAiIgnoredNoteListProps(onToggleIgnored, {
				isolateDragEvents: false,
			})}
			renderItem={(note) => { const preview = getNoteListPreview(note); const label = getNoteListLabel(note) || lang.t("New note"); return <EntityLinkedListItem text={preview.text || label} label={label} maxLength={preview.maxLength} selected={note === selected} onSelect={() => { setSelectedKey(String(note.id)); detailRef.current?.querySelectorAll<HTMLElement>(":scope > [data-note-index]")[notes.indexOf(note)]?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }} />; }}
		/>
		<div ref={detailRef} className="CampaignEntitySection__detail CampaignEntitySection__detail_stream" onScroll={(event) => {
			const top = event.currentTarget.getBoundingClientRect().top;
			const cards = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(":scope > [data-note-index]"));
			const active = cards.reduce<HTMLElement | null>((current, card) => card.getBoundingClientRect().top <= top + 24 ? card : current, cards[0] || null);
			if (active) setSelectedKey(String(notes[Number(active.dataset.noteIndex)]?.id));
		}}>
			{notes.map((note, index) => (
				<div key={String(note.id)} data-note-index={index}
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
						collapsible={false}
						onToggleCollapse={view.handleToggleNoteCollapse}
						onTitleChange={view.handleNoteTitleChange}
						onTextChange={view.handleNoteChange}
						onDelete={view.handleDeleteNote}
					/>
				</div>
			))}
		</div>
		</div>
	);
}

interface CampaignNotesViewToggleProps {
	presentation: CampaignNotesSectionPresentation;
	onViewModeChange: (mode: CampaignNotesViewMode) => void;
}

function CampaignNotesViewToggle({
	presentation,
	onViewModeChange,
}: CampaignNotesViewToggleProps) {
	return (
		<div className="CampaignNotesSection__viewToggle">
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
	viewMode: CampaignNotesViewMode;
	onViewModeChange: (mode: CampaignNotesViewMode) => void;
	onToggleIgnored: (noteId: DomainId, ignored: boolean) => void;
}

export default function CampaignNotesSection({
	campaign,
	view,
	notes,
	viewMode,
	onViewModeChange,
	onToggleIgnored,
}: CampaignNotesSectionProps) {
	const presentation = getCampaignNotesSectionPresentation({
		hasData: true,
		isCollapsed: false,
		viewMode,
	});
	return (
		<div
			id={makeDomId("campaign", "notes")}
			className="CampaignNotesSection"
			data-history-focus-id={makeHistoryTargetId("campaign", "notes")}
		>
			<div className="CampaignNotesSection__row">
				<div className="CampaignNotesSection__titleGroup">
					<h3>{lang.t("Notes")}</h3>
				</div>
				<CampaignNotesViewToggle
					presentation={presentation}
					onViewModeChange={onViewModeChange}
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
