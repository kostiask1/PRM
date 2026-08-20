import {
	useContext,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
} from "react";

import {
	Button,
	Panel,
	usePointerDownOutsideDismissal,
} from "../../../shared/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import {
	createNoteCardComponent,
	useSimplifiedNotesEnabled,
} from "../../../features/notes/ui/index.js";
import SessionHeader from "./components/SessionHeader.tsx";
import SessionChecklistOverlay from "./components/SessionChecklistOverlay.tsx";
import SessionEntitySection from "./components/SessionEntitySection.tsx";
import SessionFloatingActions from "./components/SessionFloatingActions.tsx";
import SessionNotesSection from "./components/SessionNotesSection.tsx";
import SessionResultSection from "./components/SessionResultSection.tsx";
import SessionSceneCard from "./components/SessionSceneCard.tsx";
import SessionScenesSection from "./components/SessionScenesSection.tsx";
import SessionScopeImportOverlay from "./components/SessionScopeImportOverlay.tsx";
import SessionScopedEntityModal from "./components/SessionScopedEntityModal.tsx";
import {
	CharacterCard,
	CreateCharacterButton,
	CreateLocationButton,
	LocationCard,
} from "../../../widgets/campaign-entity-card/index.js";
import "../../../assets/components/SessionView.css";
import useSessionView from "../model/useSessionView.ts";
import { useSessionHashNavigation } from "../model/useSessionHashNavigation.ts";
import {
	SessionViewModel,
	type SessionDomainId,
	type SessionScene,
} from "../../../entities/session/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	getNotesForRender,
	sanitizeNotesForSave,
} from "../../../shared/lib/index.js";
import {
	makeDomId,
	shouldOpenInNewTabFromEvent,
} from "../../../shared/lib/index.js";
import {
	EntityLinkResolverContext,
	renderMentionText,
	type EntityLinkModalState,
	type EntityLinkResolver,
} from "../../../features/entity-link/index.js";
import {
	findEntityByName,
} from "../../../entities/campaign/index.js";
import type { SessionResourceId } from "../../../features/session-editor/index.js";
import {
	getSessionEncounterLinks,
	getSessionPageData,
	getSessionScopeImportPresentation,
	getSessionSectionCollapsed,
	hasSessionNoteContent,
} from "../model/sessionPagePresentation.ts";
import {
	type SessionEntityType,
	type SessionPageEntity,
} from "../model/sessionEntityModel.ts";
import { useSessionPageRuntime } from "../model/SessionPageRuntime.tsx";

const SessionNoteCard = createNoteCardComponent({
	EditableField,
	renderMentionText,
});

function isSessionEntityId(value: unknown): value is string | number {
	return typeof value === "string" || typeof value === "number";
}

type SessionController = ReturnType<typeof useSessionView>;

function getSessionScopedEntityLinks(view: SessionController) {
	return [
		...view.sessionNpcs.map((entity) => ({
			entity: { ...entity, _scope: "session" },
			type: "npc",
			scope: "session",
		})),
		...view.sessionLocations.map((entity) => ({
			entity: { ...entity, _scope: "session" },
			type: "locations",
			scope: "session",
		})),
	];
}

function getCurrentSessionEntity(
	view: SessionController,
	modalState: EntityLinkModalState,
) {
	const items = modalState.type === "locations"
		? view.sessionLocations
		: view.sessionNpcs;
	return items.find(
		(entity) => String(entity.id) === String(modalState.entity?.id),
	) || modalState.entity;
}

function useSessionScopedEntityLinks(
	view: SessionController,
	parentEntityLinks: EntityLinkResolver | null,
): EntityLinkResolver {
	return useMemo(() => {
		const scopedEntities = getSessionScopedEntityLinks(view);
		return {
			resolveEntityByName(name: string) {
				return findEntityByName(scopedEntities, name) ||
					parentEntityLinks?.resolveEntityByName?.(name) ||
					null;
			},
			renderModalContent(modalState: EntityLinkModalState, onClose: () => void) {
				if (modalState.scope !== "session") {
					return parentEntityLinks?.renderModalContent?.(modalState, onClose);
				}
				return (
					<SessionScopedEntityModal
						type={modalState.type}
						entity={getCurrentSessionEntity(view, modalState)}
						campaignSlug={view.campaignSlug}
						onLocationChange={(id, updatedEntity) => {
							if (isSessionEntityId(id)) {
								view.handleSessionLocationChange(id, updatedEntity);
							}
						}}
						onLocationDelete={(id) => {
							if (isSessionEntityId(id)) view.handleSessionLocationDelete(id);
							onClose();
						}}
						onNpcChange={(id, updatedEntity) => {
							if (isSessionEntityId(id)) view.handleSessionNpcChange(id, updatedEntity);
						}}
						onNpcDelete={(id) => {
							if (isSessionEntityId(id)) view.handleSessionNpcDelete(id);
							onClose();
						}}
					/>
				);
			},
		};
	}, [
		parentEntityLinks,
		view.campaignSlug,
		view.handleSessionLocationChange,
		view.handleSessionLocationDelete,
		view.handleSessionNpcChange,
		view.handleSessionNpcDelete,
		view.sessionLocations,
		view.sessionNpcs,
	]);
}

interface SessionSceneItemProps {
	view: SessionController;
	scene: SessionScene;
	number: number;
	simplifiedNotesEnabled: boolean;
	onToggleNoteAiIgnored: (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
		ignored: boolean,
	) => void;
	getEncounterName: (scene: SessionScene) => string;
}

function SessionSceneItem({
	view,
	scene,
	number,
	simplifiedNotesEnabled,
	onToggleNoteAiIgnored,
	getEncounterName,
}: SessionSceneItemProps) {
	const onSceneNoteToggleCollapse = (noteId: SessionResourceId) =>
		view.handleSceneToggleNoteCollapse(scene.id, noteId);
	const onSceneNoteTitleChange = (noteId: SessionResourceId, title: string) =>
		view.handleSceneNoteTitleChange(scene.id, noteId, title);
	const onSceneNoteChange = (noteId: SessionResourceId, text: string) =>
		view.handleSceneNoteChange(scene.id, noteId, text);
	const onSceneNoteDelete = (noteId: SessionResourceId) =>
		view.handleSceneDeleteNote(scene.id, noteId);

	return (
		<div id={makeDomId("session", "scene", scene.id)}>
			<SessionSceneCard
				number={number}
				scene={scene}
				fields={SessionViewModel.sceneSchema}
				collapsed={Boolean(scene.collapsed)}
				onToggle={() => view.toggleSceneCollapse(scene.id)}
				onRemove={() => view.removeScene(scene.id)}
				onOpenEncounter={(event) => view.handleOpenEncounter(scene, event)}
				imageUrl={scene.imageUrl}
				onImageChange={(imageUrl) =>
					view.updateScene(scene.id, "imageUrl", imageUrl, true)
				}
				campaignSlug={view.campaignSlug}
				hasEncounter={Boolean(scene.encounterId)}
				encounterName={getEncounterName(scene)}
				onUpdateField={(field, value) =>
					view.updateScene(scene.id, field, value)
				}
				onToggleNotesCollapse={() =>
					view.handleToggleSceneNotesCollapse(scene.id)
				}
				onSceneNotesReorder={(notes) =>
					view.handleSceneNotesReorder(scene.id, notes)
				}
				onSceneNoteAiIgnoredChange={(noteId, ignored) =>
					onToggleNoteAiIgnored(scene.id, noteId, ignored)
				}
				simplifiedNotesEnabled={simplifiedNotesEnabled}
				renderNoteCard={(note, isLast) => (
					<SessionNoteCard
						note={note}
						isLast={isLast}
						campaignSlug={view.campaignSlug}
						enableHistory={false}
						onToggleCollapse={onSceneNoteToggleCollapse}
						onTitleChange={onSceneNoteTitleChange}
						onTextChange={onSceneNoteChange}
						onDelete={onSceneNoteDelete}
					/>
				)}
			/>
		</div>
	);
}

function getSessionViewList<T>(value: T[] | null | undefined): T[] {
	return value || [];
}

function getSessionPageDataRecord(session: SessionController["session"]) {
	return session || {};
}

function SessionView() {
	const { activeSessionFileName: sessionId, navigateToEncounter } =
		useSessionPageRuntime();
	const view = useSessionView();
	const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
	const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
	const headerActionsRef = useRef<HTMLDivElement | null>(null);
	const session = view.session;
	const simplifiedNotesEnabled = useSimplifiedNotesEnabled();
	const parentEntityLinks = useContext(EntityLinkResolverContext);
	const sessionScopedEntityLinks = useSessionScopedEntityLinks(
		view,
		parentEntityLinks,
	);

	const sessionData = getSessionPageData(session);
	const viewModel = useMemo(
		() =>
			new SessionViewModel({
				...getSessionPageDataRecord(session),
				data: sessionData,
				isSaving: view.isSaving,
			}),
		[session, sessionData, view.isSaving],
	);
	const hasSessionNotesData = hasSessionNoteContent(viewModel.notes);
	const sessionNotes = getSessionViewList(viewModel.notes);
	const sessionNotesForRender = getNotesForRender(sessionNotes, {
		simplifiedNotes: simplifiedNotesEnabled,
	});
	const scenes = useMemo(() => getSessionViewList(viewModel.scenes), [viewModel]);
	const isSessionNotesCollapsed = getSessionSectionCollapsed(
		hasSessionNotesData,
		sessionData.isNotesCollapsed,
	);
	const sessionEncounters = getSessionEncounterLinks(
		scenes,
		viewModel.encounters,
		lang.t("Untitled"),
	);
	const { handleToggleSectionCollapse } = view;
	useSessionHashNavigation({
		sessionId,
		isSessionNotesCollapsed,
		sessionNotesForRender,
		sessionLocations: view.sessionLocations,
		sessionNpcs: view.sessionNpcs,
		scenes,
		onToggleSectionCollapse: handleToggleSectionCollapse,
	});
	usePointerDownOutsideDismissal({
		containerRef: headerActionsRef,
		isOpen: isHeaderActionsOpen,
		setIsOpen: setIsHeaderActionsOpen,
	});

	if (!session) return null;

	const openEncounterFromQuickAccess = (
		encounterId: SessionDomainId,
		event: MouseEvent<HTMLButtonElement>,
	) => {
		navigateToEncounter(
			view.campaignSlug,
			sessionId,
			encounterId,
			shouldOpenInNewTabFromEvent(event),
		);
	};

	const scopeImportModal = view.scopeImportModal;
	const {
		type: scopeImportType,
		copy: scopeImportCopy,
	} = getSessionScopeImportPresentation(scopeImportModal, lang.t);
	const toggleSessionNoteAiIgnored = (
		noteId: SessionResourceId,
		ignored: boolean,
	) => {
		view.updateData(
			"notes",
			(viewModel.notes || []).map((note) =>
				note.id === noteId ? { ...note, _aiIgnored: ignored } : note,
			),
		);
	};
	const toggleSessionEntityAiIgnored = (
		type: SessionEntityType,
		entityId: string | number,
		ignored: boolean,
	) => {
		const list =
			type === "locations" ? view.sessionLocations : view.sessionNpcs;
		const entity = list.find((item) => item.id === entityId);
		if (!entity) return;
		if (type === "locations") {
			view.handleSessionLocationChange(entityId, {
				...entity,
				_aiIgnored: ignored,
			});
			return;
		}
		view.handleSessionNpcChange(entityId, { ...entity, _aiIgnored: ignored });
	};
	const toggleSceneNoteAiIgnored = (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
		ignored: boolean,
	) => {
		const scene = (viewModel.scenes || []).find((item) => item.id === sceneId);
		if (!scene) return;
		view.handleSceneNotesReorder(
			sceneId,
			(scene.notes || []).map((note) =>
				note.id === noteId ? { ...note, _aiIgnored: ignored } : note,
			),
		);
	};
	const handleBulkSessionNotesCollapse = (collapsed: boolean) => {
		view.updateData(
			"notes",
			(viewModel.notes || []).map((note) => ({ ...note, collapsed })),
			true,
		);
	};

	const handleBulkSessionEntitiesCollapse = (
		type: SessionEntityType,
		items: SessionPageEntity[],
		collapsed: boolean,
	) => {
		view.updateData(
			type === "locations" ? "locations" : "npcs",
			items.map((item) => ({ ...item, collapsed })),
			true,
		);
	};

	const handleBulkScenesCollapse = (collapsed: boolean) => {
		view.updateData(
			"scenes",
			scenes.map((scene) => ({ ...scene, collapsed })),
			true,
		);
	};
	const getEncounterName = (scene: SessionScene) =>
		lang.t(viewModel.findEncounterName(scene));

	return (
		<EntityLinkResolverContext.Provider value={sessionScopedEntityLinks}>
			<Panel className="SessionView">
				<SessionHeader
					sessionName={session.name}
					encounters={sessionEncounters}
					isActionsOpen={isHeaderActionsOpen}
					actionsRef={headerActionsRef}
					isSaving={view.isSaving}
					canUndo={view.undoStack.length > 0}
					canRedo={view.redoStack.length > 0}
					onBack={view.handleBack}
					onRename={view.handleRename}
					onOpenEncounter={openEncounterFromQuickAccess}
					onToggleActions={() => setIsHeaderActionsOpen((value) => !value)}
					onOpenSearch={() => {
						setIsHeaderActionsOpen(false);
						setIsGlobalSearchOpen(true);
					}}
					onUndo={() => {
						setIsHeaderActionsOpen(false);
						view.handleUndo();
					}}
					onRedo={() => {
						setIsHeaderActionsOpen(false);
						view.handleRedo();
					}}
					onDelete={() => {
						setIsHeaderActionsOpen(false);
						void view.handleDeleteSessionAndBack();
					}}
				/>

				<div className="Panel__body">
					<div className="SessionView__todoList">
						<SessionNotesSection
							notes={viewModel.notes}
							renderableNotes={sessionNotesForRender}
							hasData={hasSessionNotesData}
							isCollapsed={isSessionNotesCollapsed}
							onToggle={() => view.handleToggleSectionCollapse("Notes")}
							onBulkCollapse={handleBulkSessionNotesCollapse}
							onToggleAiIgnored={toggleSessionNoteAiIgnored}
							onReorder={(nextNotes) =>
								view.updateData("notes", sanitizeNotesForSave(nextNotes))
							}
							renderItem={(note, _isDragging, index) => (
								<div id={makeDomId("session", "note", note.id)}>
									<SessionNoteCard
										note={note}
										isLast={index === sessionNotesForRender.length - 1}
										campaignSlug={view.campaignSlug}
										enableHistory={false}
										onToggleCollapse={view.handleToggleNoteCollapse}
										onTitleChange={view.handleNoteTitleChange}
										onTextChange={view.handleNoteChange}
										onDelete={view.handleDeleteNote}
									/>
								</div>
							)}
						/>
						<SessionEntitySection
							title={lang.t("Session NPCs")}
							actions={
								<>
									<CreateCharacterButton
										buttonVariant="primary"
										campaignSlug={view.campaignSlug}
										entityType="npc"
										buttonLabel={lang.t("New session NPC")}
										buttonClassName="SessionView__mobileIconOnly"
										onCreate={view.handleCreateSessionNpc}
									/>
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="import"
										className="SessionView__mobileIconOnly"
										onClick={() => view.openCampaignScopeImport("npc")}
									>
										{lang.t("Move from campaign")}
									</Button>
								</>
							}
							emptyText={lang.t("No session NPCs yet.")}
							items={view.sessionNpcs}
							listClassName="SessionView__characters"
							onBulkCollapse={(items, collapsed) =>
								handleBulkSessionEntitiesCollapse("npc", items, collapsed)
							}
							onReorder={view.handleSessionNpcsReorder}
							onToggleAiIgnored={(entityId, ignored) =>
								toggleSessionEntityAiIgnored("npc", entityId, ignored)
							}
							renderItem={(npc) => (
								<div id={makeDomId("session", "npc", npc.id)}>
									<CharacterCard
										character={npc}
										onToggleCollapse={view.handleSessionNpcToggleCollapse}
										onChange={view.handleSessionNpcChange}
										onDelete={view.handleSessionNpcDelete}
										campaignSlug={view.campaignSlug}
										enableHistory={false}
										type="npc"
										headerActions={
											<Button
												variant="ghost"
												size={Button.SIZES.SMALL}
												icon="export"
												iconSize={14}
												onClick={() =>
													view.moveSessionEntityToCampaign("npc", npc.id)
												}
												title={lang.t("Move to campaign")}
											/>
										}
									/>
								</div>
							)}
						/>

						<SessionEntitySection
							title={lang.t("Session locations/factions")}
							actions={
								<>
									<CreateLocationButton
										buttonVariant="primary"
										campaignSlug={view.campaignSlug}
										buttonLabel={lang.t("New session location/faction")}
										buttonClassName="SessionView__mobileIconOnly"
										onCreate={view.handleCreateSessionLocation}
									/>
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="import"
										className="SessionView__mobileIconOnly"
										onClick={() => view.openCampaignScopeImport("locations")}
									>
										{lang.t("Move from campaign")}
									</Button>
								</>
							}
							emptyText={lang.t("No session locations/factions yet.")}
							items={view.sessionLocations}
							listClassName="SessionView__locations"
							onBulkCollapse={(items, collapsed) =>
								handleBulkSessionEntitiesCollapse("locations", items, collapsed)
							}
							onReorder={view.handleSessionLocationsReorder}
							onToggleAiIgnored={(entityId, ignored) =>
								toggleSessionEntityAiIgnored("locations", entityId, ignored)
							}
							renderItem={(location) => (
								<div id={makeDomId("session", "location", location.id)}>
									<LocationCard
										location={location}
										onToggleCollapse={view.handleSessionLocationToggleCollapse}
										onChange={view.handleSessionLocationChange}
										onDelete={view.handleSessionLocationDelete}
										campaignSlug={view.campaignSlug}
										enableHistory={false}
										headerActions={
											<Button
												variant="ghost"
												size={Button.SIZES.SMALL}
												icon="export"
												iconSize={14}
												onClick={() =>
													view.moveSessionEntityToCampaign("locations", location.id)
												}
												title={lang.t("Move to campaign")}
											/>
										}
									/>
								</div>
							)}
						/>
						<SessionScenesSection
							scenes={scenes}
							onBulkCollapse={handleBulkScenesCollapse}
							onAddScene={view.addScene}
							onReorder={(nextScenes) => view.updateData("scenes", nextScenes)}
							renderScene={(scene) => (
								<SessionSceneItem
									view={view}
									scene={scene}
									number={scenes.findIndex((item) => item.id === scene.id) + 1}
									simplifiedNotesEnabled={simplifiedNotesEnabled}
									onToggleNoteAiIgnored={toggleSceneNoteAiIgnored}
									getEncounterName={getEncounterName}
								/>
							)}
						/>

						<SessionResultSection
							value={String(sessionData.result_text || "")}
							onChange={(value) => view.updateData("result_text", value)}
						/>
					</div>
				</div>

				{view.isChecklistOpen && (
					<SessionChecklistOverlay
						checklistItems={view.checklistItems}
						onClose={() => view.setIsChecklistOpen(false)}
						onChecklistItemChange={(itemId, checked) =>
							view.updateData(`${itemId}_check`, checked, true)
						}
						progress={view.progress}
						sessionData={sessionData}
					/>
				)}
				<SessionScopeImportOverlay
					modal={scopeImportModal}
					copy={scopeImportCopy}
					type={scopeImportType}
					onClose={view.closeScopeImportModal}
					onMoveToSession={(type, entity) =>
						view.moveCampaignEntityToSession(type, entity)
					}
				/>
				<SessionFloatingActions
					progress={view.progress}
					isGlobalSearchOpen={isGlobalSearchOpen}
					onOpenChecklist={() => view.setIsChecklistOpen(true)}
					onCloseGlobalSearch={() => setIsGlobalSearchOpen(false)}
				/>
			</Panel>
		</EntityLinkResolverContext.Provider>
	);
}

export default SessionView;
