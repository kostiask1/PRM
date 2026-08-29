import type { MouseEvent, ReactNode } from "react";
import "../../../../assets/components/SessionSceneCard.css";
import type { SessionScene } from "../../../../entities/session/index.js";
import { lang, type SharedNote } from "../../../../shared/lib/index.js";
import SceneCardFields, {
	type SceneCardFieldDefinition,
} from "./SceneCardFields.tsx";
import SceneCardHeader from "./SceneCardHeader.tsx";
import SceneCardMedia from "./SceneCardMedia.tsx";
import SceneNotes from "./SceneNotes.tsx";

interface SessionSceneCardProps {
	number: number;
	scene: SessionScene;
	fields: readonly SceneCardFieldDefinition[];
	collapsed: boolean;
	onToggle: () => void;
	onRemove: () => void;
	onOpenEncounter: (event: MouseEvent<HTMLButtonElement>) => void;
	imageUrl?: string | null;
	onImageChange: (imageUrl: string | null) => void;
	campaignSlug?: string | null;
	hasEncounter: boolean;
	encounterName: string;
	onUpdateField: (field: string, value: string) => void;
	onToggleNotesCollapse: () => void;
	onSceneNotesReorder: (notes: SharedNote[]) => void;
	onSceneNoteAiIgnoredChange: (
		noteId: SharedNote["id"],
		ignored: boolean,
	) => void;
	simplifiedNotesEnabled: boolean;
	renderNoteCard: (note: SharedNote, isLast: boolean) => ReactNode;
}

export default function SessionSceneCard(props: SessionSceneCardProps) {
	const encounterLabel = props.hasEncounter
		? props.encounterName
		: lang.t("New encounter");

	return (
		<div className="SessionSceneCard">
			<SceneCardHeader
				number={props.number}
				collapsed={props.collapsed}
				onToggle={props.onToggle}
				onOpenEncounter={props.onOpenEncounter}
				onRemove={props.onRemove}
				hasEncounter={props.hasEncounter}
				encounterName={encounterLabel}
			/>
			{!props.collapsed && (
				<div className="SessionSceneCard__content">
					<div className="SessionSceneCard__textSide">
						<SceneCardFields
							fields={props.fields}
							scene={props.scene}
							enableHistory={false}
							onUpdateField={props.onUpdateField}
						/>
						<SceneNotes
							scene={props.scene}
							simplifiedNotesEnabled={props.simplifiedNotesEnabled}
							onSceneNoteAiIgnoredChange={props.onSceneNoteAiIgnoredChange}
							onSceneNotesReorder={props.onSceneNotesReorder}
							onToggleNotesCollapse={props.onToggleNotesCollapse}
							renderNoteCard={props.renderNoteCard}
						/>
					</div>
					<SceneCardMedia
						number={props.number}
						imageUrl={props.imageUrl}
						campaignSlug={props.campaignSlug}
						onImageChange={props.onImageChange}
					/>
				</div>
			)}
		</div>
	);
}
