import type { MouseEvent, RefObject } from "react";
import "../../../../assets/components/SessionHeader.css";
import { Button } from "../../../../shared/ui/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { renderMentionText } from "../../../../features/entity-link/index.js";
import type { SessionDomainId } from "../../../../entities/session/index.js";
import type { SessionEncounterLink } from "../../model/sessionPagePresentation.ts";
import SessionHeaderActions from "./SessionHeaderActions.tsx";

interface SessionHeaderProps {
	sessionName?: string;
	encounters: readonly SessionEncounterLink[];
	isActionsOpen: boolean;
	actionsRef: RefObject<HTMLDivElement>;
	isSaving: boolean;
	isHistoryRestoring: boolean;
	canUndo: boolean;
	canRedo: boolean;
	redoTitle?: string;
	undoTitle?: string;
	onBack: () => void;
	onRename: () => void;
	onOpenEncounter: (
		encounterId: SessionDomainId,
		event: MouseEvent<HTMLButtonElement>,
	) => void;
	onToggleActions: () => void;
	onOpenSearch: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onDelete: () => void;
}

export default function SessionHeader({
	sessionName,
	encounters,
	isActionsOpen,
	actionsRef,
	isSaving,
	isHistoryRestoring,
	canUndo,
	canRedo,
	redoTitle,
	undoTitle,
	onBack,
	onRename,
	onOpenEncounter,
	onToggleActions,
	onOpenSearch,
	onUndo,
	onRedo,
	onDelete,
}: SessionHeaderProps) {
	return (
		<div className="Panel__header">
			<div className="SessionHeader">
				<div className="SessionHeader__titleGroup">
					<div className="SessionHeader__titleRow">
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							onClick={onBack}
							icon="back"
							className="SessionHeader__backButton"
						/>
						<h2 className="editable_title" onClick={onRename}>
							{sessionName}
						</h2>
					</div>
					{encounters.length > 0 && (
						<div className="SessionHeader__encounters">
							<span className="SessionHeader__encountersLabel">
								{lang.t("Combat encounters")}:
							</span>
							<div className="SessionHeader__encountersList">
								{encounters.map((encounter) => (
									<Button
										key={encounter.id}
										variant="ghost"
										size={Button.SIZES.SMALL}
										onClick={(event) =>
											onOpenEncounter(encounter.id, event)
										}
									>
										{renderMentionText(
											encounter.sceneNumber
												? `${lang.t("Scene {number}", {
														number: encounter.sceneNumber,
													})}: ${encounter.name}`
												: encounter.name,
										)}
									</Button>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
			<SessionHeaderActions
				actionsRef={actionsRef}
				canRedo={canRedo}
				canUndo={canUndo}
				isOpen={isActionsOpen}
				isSaving={isSaving}
				isHistoryRestoring={isHistoryRestoring}
				onDelete={onDelete}
				onOpenSearch={onOpenSearch}
				onRedo={onRedo}
				onToggle={onToggleActions}
				onUndo={onUndo}
				redoTitle={redoTitle}
				undoTitle={undoTitle}
			/>
		</div>
	);
}
