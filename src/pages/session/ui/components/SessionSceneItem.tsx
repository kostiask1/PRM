import type { MouseEvent } from "react";
import {
	SessionViewModel,
	type SessionScene,
} from "../../../../entities/session/index.js";
import type { SessionResourceId } from "../../../../features/session-editor/index.js";
import { makeDomId } from "../../../../shared/lib/index.js";
import { makeHistoryTargetId } from "../../../../entities/history/index.js";
import SessionNoteCard from "./SessionNoteCard.tsx";
import SessionSceneCard from "./SessionSceneCard.tsx";

interface SessionSceneItemProps {
	scene: SessionScene;
	number: number;
	campaignSlug: string;
	simplifiedNotesEnabled: boolean;
	onToggle: (sceneId: SessionResourceId) => void;
	onRemove: (sceneId: SessionResourceId) => void;
	onOpenEncounter: (
		scene: SessionScene,
		event: MouseEvent<HTMLButtonElement>,
	) => void;
	onImageChange: (sceneId: SessionResourceId, imageUrl: string | null) => void;
	onUpdateField: (
		sceneId: SessionResourceId,
		field: string,
		value: unknown,
	) => void;
	onToggleNotesCollapse: (sceneId: SessionResourceId) => void;
	onNotesReorder: (
		sceneId: SessionResourceId,
		notes: NonNullable<SessionScene["notes"]>,
	) => void;
	onToggleNoteAiIgnored: (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
		ignored: boolean,
	) => void;
	onToggleNoteCollapse: (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
	) => void;
	onNoteTitleChange: (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
		title: string,
	) => void;
	onNoteChange: (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
		text: string,
	) => void;
	onNoteDelete: (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
	) => void;
	getEncounterName: (scene: SessionScene) => string;
}

function SessionSceneItem({
	scene,
	number,
	campaignSlug,
	simplifiedNotesEnabled,
	onToggle,
	onRemove,
	onOpenEncounter,
	onImageChange,
	onUpdateField,
	onToggleNotesCollapse,
	onNotesReorder,
	onToggleNoteAiIgnored,
	onToggleNoteCollapse,
	onNoteTitleChange,
	onNoteChange,
	onNoteDelete,
	getEncounterName,
}: SessionSceneItemProps) {
	const onSceneNoteToggleCollapse = (noteId: SessionResourceId) =>
		onToggleNoteCollapse(scene.id, noteId);
	const onSceneNoteTitleChange = (noteId: SessionResourceId, title: string) =>
		onNoteTitleChange(scene.id, noteId, title);
	const onSceneNoteChange = (noteId: SessionResourceId, text: string) =>
		onNoteChange(scene.id, noteId, text);
	const onSceneNoteDelete = (noteId: SessionResourceId) =>
		onNoteDelete(scene.id, noteId);

	return (
		<div
			id={makeDomId("session", "scene", scene.id)}
			data-history-focus-id={makeHistoryTargetId(
				"session",
				"scene",
				scene.id,
			)}
		>
			<SessionSceneCard
				number={number}
				scene={scene}
				fields={SessionViewModel.sceneSchema}
				collapsed={Boolean(scene.collapsed)}
				onToggle={() => onToggle(scene.id)}
				onRemove={() => onRemove(scene.id)}
				onOpenEncounter={(event) => onOpenEncounter(scene, event)}
				imageUrl={scene.imageUrl}
				onImageChange={(imageUrl) =>
					onImageChange(scene.id, imageUrl)
				}
				campaignSlug={campaignSlug}
				hasEncounter={Boolean(scene.encounterId)}
				encounterName={getEncounterName(scene)}
				onUpdateField={(field, value) =>
					onUpdateField(scene.id, field, value)
				}
				onToggleNotesCollapse={() =>
					onToggleNotesCollapse(scene.id)
				}
				onSceneNotesReorder={(notes) =>
					onNotesReorder(scene.id, notes)
				}
				onSceneNoteAiIgnoredChange={(noteId, ignored) =>
					onToggleNoteAiIgnored(scene.id, noteId, ignored)
				}
				simplifiedNotesEnabled={simplifiedNotesEnabled}
				renderNoteCard={(note, isLast) => (
					<div
						id={makeDomId(
							"session",
							"scene",
							scene.id,
							"note",
							note.id,
						)}
						data-history-focus-id={makeHistoryTargetId(
							"session",
							"scene-note",
							scene.id,
							note.id,
						)}
					>
						<SessionNoteCard
							note={note}
							isLast={isLast}
							campaignSlug={campaignSlug}
							enableHistory={false}
							onToggleCollapse={onSceneNoteToggleCollapse}
							onTitleChange={onSceneNoteTitleChange}
							onTextChange={onSceneNoteChange}
							onDelete={onSceneNoteDelete}
						/>
					</div>
				)}
			/>
		</div>
	);
}

export default SessionSceneItem;
