import type { ReactNode } from "react";

import type { SessionScene } from "../../../../entities/session/index.js";
import { getAiIgnoredNoteListProps } from "../../../../features/notes/ui/index.js";
import type { SessionResourceId } from "../../../../features/session-editor/index.js";
import { lang, type SharedNote } from "../../../../shared/lib/index.js";
import {
	Button,
	CollapseToggleButton,
	DraggableList,
} from "../../../../shared/ui/index.js";
import {
	getSceneNotesWithCollapsedState,
	getSessionSceneNotesPresentation,
	type SessionSceneNotesPresentation,
} from "../../model/sessionPagePresentation.ts";

interface SceneNotesProps {
	onSceneNoteAiIgnoredChange: (
		noteId: SessionResourceId,
		ignored: boolean,
	) => void;
	onSceneNotesReorder: (notes: SharedNote[]) => void;
	onToggleNotesCollapse: () => void;
	renderNoteCard: (note: SharedNote, isLast: boolean) => ReactNode;
	scene: SessionScene;
	simplifiedNotesEnabled: boolean;
}

export default function SceneNotes({
	onSceneNoteAiIgnoredChange,
	onSceneNotesReorder,
	onToggleNotesCollapse,
	renderNoteCard,
	scene,
	simplifiedNotesEnabled,
}: SceneNotesProps) {
	const presentation = getSessionSceneNotesPresentation(
		scene.notes,
		scene.isNotesCollapsed,
		simplifiedNotesEnabled,
	);
	const handleBulkSceneNotesCollapse = () => {
		onSceneNotesReorder(
			getSceneNotesWithCollapsedState(
				presentation.notes,
				presentation.bulkActionShouldCollapse,
			),
		);
	};

	return (
		<div className="SceneCard__notes">
			{renderSceneNotesHeader({
				onBulkSceneNotesCollapse: handleBulkSceneNotesCollapse,
				onToggleNotesCollapse,
				presentation,
			})}
			{presentation.showList && (
				renderSceneNotesList({
					onSceneNoteAiIgnoredChange,
					onSceneNotesReorder,
					presentation,
					renderNoteCard,
				})
			)}
		</div>
	);
}

interface SceneNotesHeaderProps {
	onBulkSceneNotesCollapse: () => void;
	onToggleNotesCollapse: () => void;
	presentation: SessionSceneNotesPresentation;
}

function renderSceneNotesHeader({
	onBulkSceneNotesCollapse,
	onToggleNotesCollapse,
	presentation,
}: SceneNotesHeaderProps) {
	return (
		<div className="SceneCard__notes_headerRow">
			<div
				className="SceneCard__notes_header"
				onClick={presentation.hasData ? onToggleNotesCollapse : undefined}
			>
				{presentation.hasData && (
					<CollapseToggleButton
						size={Button.SIZES.SMALL}
						collapsed={presentation.isCollapsed}
						onClick={onToggleNotesCollapse}
					/>
				)}
				<label>{lang.t("Scene notes")}</label>
			</div>
			{presentation.showBulkAction && (
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="chevron"
					iconSize={16}
					onClick={onBulkSceneNotesCollapse}
					title={lang.t(presentation.bulkActionTitleKey)}
				>
					{lang.t(presentation.bulkActionLabelKey)}
				</Button>
			)}
		</div>
	);
}

interface SceneNotesListProps {
	onSceneNoteAiIgnoredChange: (
		noteId: SessionResourceId,
		ignored: boolean,
	) => void;
	onSceneNotesReorder: (notes: SharedNote[]) => void;
	presentation: SessionSceneNotesPresentation;
	renderNoteCard: (note: SharedNote, isLast: boolean) => ReactNode;
}

function renderSceneNotesList({
	onSceneNoteAiIgnoredChange,
	onSceneNotesReorder,
	presentation,
	renderNoteCard,
}: SceneNotesListProps) {
	return (
		<DraggableList
			items={presentation.renderableNotes}
			className="SceneCard__notes_list"
			onReorder={onSceneNotesReorder}
			{...getAiIgnoredNoteListProps(onSceneNoteAiIgnoredChange)}
			renderItem={(note, isDragging, index) =>
				renderNoteCard(
					note,
					index === presentation.renderableNotes.length - 1,
				)
			}
		/>
	);
}
