import type { MouseEvent, RefObject } from "react";
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
	canUndo: boolean;
	canRedo: boolean;
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
	canUndo,
	canRedo,
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
			<div className="SessionView__header">
				<div className="SessionView__titleGroup">
					<div className="SessionView__titleRow">
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							onClick={onBack}
							icon="back"
							className="SessionView__backBtn"
						/>
						<h2 className="editable_title" onClick={onRename}>
							{sessionName}
						</h2>
					</div>
					{encounters.length > 0 && (
						<div className="SessionView__encountersQuickAccess">
							<span className="SessionView__encountersLabel">
								{lang.t("Combat encounters")}:
							</span>
							<div className="SessionView__encountersList">
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
				onDelete={onDelete}
				onOpenSearch={onOpenSearch}
				onRedo={onRedo}
				onToggle={onToggleActions}
				onUndo={onUndo}
			/>
		</div>
	);
}
