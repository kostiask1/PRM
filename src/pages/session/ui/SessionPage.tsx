import {
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
} from "react";

import {
	Button,
	DraggableList,
	Icon,
	Panel,
	Tooltip,
	usePointerDownOutsideDismissal,
} from "../../../shared/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import {
	AiContextIgnoreButton,
	BulkCollapseButton,
	createNoteCardComponent,
	getAiIgnoredNoteListProps,
	useSimplifiedNotesEnabled,
} from "../../../features/notes/ui/index.js";
import TodoSection from "./components/TodoSection.tsx";
import SceneCardHeader from "./components/SceneCardHeader.tsx";
import SceneCardMedia from "./components/SceneCardMedia.tsx";
import SceneCardFields from "./components/SceneCardFields.tsx";
import SessionHeader from "./components/SessionHeader.tsx";
import SessionChecklistOverlay from "./components/SessionChecklistOverlay.tsx";
import SessionScopeImportOverlay from "./components/SessionScopeImportOverlay.tsx";
import SceneNotes from "./components/SceneNotes.tsx";
import { GlobalSearchModal } from "../../../widgets/campaign-search/index.js";
import {
	CharacterCard,
	CreateCharacterButton,
	CreateLocationButton,
	LocationCard,
} from "../../../widgets/campaign-entity-card/index.js";
import "../../../assets/components/SessionView.css";
import useSessionView from "../model/useSessionView.ts";
import {
	SessionViewModel,
	type SessionDomainId,
	type SessionScene,
} from "../../../entities/session/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	getNoteRenderKey,
	getNotesForRender,
	sanitizeNotesForSave,
} from "../../../shared/lib/index.js";
import {
	makeDomId,
	scrollToHashTarget,
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
import type { SharedNote } from "../../../shared/lib/index.js";
import type { SessionResourceId } from "../../../features/session-editor/index.js";
import {
	getSessionEncounterLinks,
	getSessionPageData,
	getSessionScopeImportPresentation,
	getSessionSectionCollapsed,
	hasSessionNoteContent,
	shouldExpandSessionNotesFromHash,
} from "../model/sessionPagePresentation.ts";
import {
	normalizeSessionEntity,
	type SessionEntityType,
	type SessionPageEntity,
} from "../model/sessionEntityModel.ts";
import { useSessionPageRuntime } from "../model/SessionPageRuntime.tsx";
import type { SceneCardFieldDefinition } from "./components/SceneCardFields.tsx";

const SessionNoteCard = createNoteCardComponent({
	EditableField,
	renderMentionText,
});

function isSessionEntityId(value: unknown): value is string | number {
	return typeof value === "string" || typeof value === "number";
}

type SessionController = ReturnType<typeof useSessionView>;
type RenderableSessionNote = SharedNote & {
	_isVirtual?: boolean;
	_renderKey?: string | number;
};

interface SessionScopedEntityModalProps {
	view: SessionController;
	modalState: EntityLinkModalState;
	onClose: () => void;
}

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

function SessionScopedLocationModal({
	view,
	modalState,
	onClose,
}: SessionScopedEntityModalProps) {
	const location = normalizeSessionEntity(
		"locations",
		getCurrentSessionEntity(view, modalState),
	);
	return (
		<LocationCard
			key={location.id}
			location={{ ...location, collapsed: false }}
			onChange={(id, updatedEntity) => {
				if (isSessionEntityId(id)) {
					view.handleSessionLocationChange(id, updatedEntity);
				}
			}}
			onDelete={(id) => {
				if (isSessionEntityId(id)) view.handleSessionLocationDelete(id);
				onClose();
			}}
			onToggleCollapse={null}
			campaignSlug={view.campaignSlug}
			enableHistory={false}
			viewMode="modal"
		/>
	);
}

function SessionScopedNpcModal({
	view,
	modalState,
	onClose,
}: SessionScopedEntityModalProps) {
	const npc = normalizeSessionEntity(
		"npc",
		getCurrentSessionEntity(view, modalState),
	);
	return (
		<CharacterCard
			key={npc.id}
			character={{ ...npc, collapsed: false }}
			onChange={(id, updatedEntity) => {
				if (isSessionEntityId(id)) view.handleSessionNpcChange(id, updatedEntity);
			}}
			onDelete={(id) => {
				if (isSessionEntityId(id)) view.handleSessionNpcDelete(id);
				onClose();
			}}
			onToggleCollapse={null}
			campaignSlug={view.campaignSlug}
			enableHistory={false}
			type="npc"
			viewMode="modal"
		/>
	);
}

function SessionScopedEntityModal(props: SessionScopedEntityModalProps) {
	return props.modalState.type === "locations"
		? <SessionScopedLocationModal {...props} />
		: <SessionScopedNpcModal {...props} />;
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
						view={view}
						modalState={modalState}
						onClose={onClose}
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

interface SessionNotesSectionProps {
	view: SessionController;
	notes: readonly SharedNote[];
	renderableNotes: RenderableSessionNote[];
	hasData: boolean;
	isCollapsed: boolean;
	onBulkCollapse: (collapsed: boolean) => void;
	onToggleAiIgnored: (noteId: SessionResourceId, ignored: boolean) => void;
}

function SessionNotesSection({
	view,
	notes,
	renderableNotes,
	hasData,
	isCollapsed,
	onBulkCollapse,
	onToggleAiIgnored,
}: SessionNotesSectionProps) {
	return (
		<TodoSection
			title={lang.t("Notes")}
			collapsed={isCollapsed}
			onToggle={hasData ? () => view.handleToggleSectionCollapse("Notes") : undefined}
			action={!isCollapsed && <BulkCollapseButton items={notes} onChange={onBulkCollapse} />}
		>
			{!isCollapsed && (
				<DraggableList
					items={renderableNotes}
					className="SessionView__notes"
					onReorder={(nextNotes) =>
						view.updateData("notes", sanitizeNotesForSave(nextNotes))
					}
					keyExtractor={(note, index) => getNoteRenderKey(note, index)}
					isItemDraggable={(note) => !note._isVirtual}
					isItemControlActive={(note) => Boolean(note._aiIgnored)}
					renderItemControl={(note) =>
						!note._isVirtual && (
							<AiContextIgnoreButton
								ignored={Boolean(note._aiIgnored)}
								onToggle={(ignored) => onToggleAiIgnored(note.id, ignored)}
							/>
						)
					}
					renderItem={(note, _isDragging, index) => (
						<div id={makeDomId("session", "note", note.id)}>
							<SessionNoteCard
								note={note}
								isLast={index === renderableNotes.length - 1}
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
			)}
		</TodoSection>
	);
}

interface SessionEntitySectionProps {
	view: SessionController;
	onBulkCollapse: (
		type: SessionEntityType,
		items: SessionPageEntity[],
		collapsed: boolean,
	) => void;
	onToggleAiIgnored: (
		type: SessionEntityType,
		entityId: string | number,
		ignored: boolean,
	) => void;
}

function SessionNpcSection({
	view,
	onBulkCollapse,
	onToggleAiIgnored,
}: SessionEntitySectionProps) {
	const items = view.sessionNpcs;
	return (
		<TodoSection
			title={lang.t("Session NPCs")}
			action={
				<div className="SessionView__sectionActions">
					<BulkCollapseButton items={items} onChange={(collapsed) => onBulkCollapse("npc", items, collapsed)} />
					<CreateCharacterButton
						buttonVariant="primary"
						campaignSlug={view.campaignSlug}
						entityType="npc"
						buttonLabel={lang.t("New session NPC")}
						buttonClassName="SessionView__mobileIconOnly"
						onCreate={view.handleCreateSessionNpc}
					/>
					<Button variant="ghost" size={Button.SIZES.SMALL} icon="import" className="SessionView__mobileIconOnly" onClick={() => view.openCampaignScopeImport("npc")}>
						{lang.t("Move from campaign")}
					</Button>
				</div>
			}
		>
			{items.length > 0 ? (
				<DraggableList
					items={items}
					className="SessionView__characters"
					onReorder={view.handleSessionNpcsReorder}
					keyExtractor={(npc) => npc.id}
					isItemControlActive={(npc) => Boolean(npc._aiIgnored)}
					renderItemControl={(npc) => (
						<AiContextIgnoreButton ignored={Boolean(npc._aiIgnored)} onToggle={(ignored) => onToggleAiIgnored("npc", npc.id, ignored)} />
					)}
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
									<Button variant="ghost" size={Button.SIZES.SMALL} icon="export" iconSize={14} onClick={() => view.moveSessionEntityToCampaign("npc", npc.id)} title={lang.t("Move to campaign")} />
								}
							/>
						</div>
					)}
				/>
			) : (
				<div className="muted SessionView__emptySection">{lang.t("No session NPCs yet.")}</div>
			)}
		</TodoSection>
	);
}

function SessionLocationSection({
	view,
	onBulkCollapse,
	onToggleAiIgnored,
}: SessionEntitySectionProps) {
	const items = view.sessionLocations;
	return (
		<TodoSection
			title={lang.t("Session locations/factions")}
			action={
				<div className="SessionView__sectionActions">
					<BulkCollapseButton items={items} onChange={(collapsed) => onBulkCollapse("locations", items, collapsed)} />
					<CreateLocationButton
						buttonVariant="primary"
						campaignSlug={view.campaignSlug}
						buttonLabel={lang.t("New session location/faction")}
						buttonClassName="SessionView__mobileIconOnly"
						onCreate={view.handleCreateSessionLocation}
					/>
					<Button variant="ghost" size={Button.SIZES.SMALL} icon="import" className="SessionView__mobileIconOnly" onClick={() => view.openCampaignScopeImport("locations")}>
						{lang.t("Move from campaign")}
					</Button>
				</div>
			}
		>
			{items.length > 0 ? (
				<DraggableList
					items={items}
					className="SessionView__locations"
					onReorder={view.handleSessionLocationsReorder}
					keyExtractor={(location) => location.id}
					isItemControlActive={(location) => Boolean(location._aiIgnored)}
					renderItemControl={(location) => (
						<AiContextIgnoreButton ignored={Boolean(location._aiIgnored)} onToggle={(ignored) => onToggleAiIgnored("locations", location.id, ignored)} />
					)}
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
									<Button variant="ghost" size={Button.SIZES.SMALL} icon="export" iconSize={14} onClick={() => view.moveSessionEntityToCampaign("locations", location.id)} title={lang.t("Move to campaign")} />
								}
							/>
						</div>
					)}
				/>
			) : (
				<div className="muted SessionView__emptySection">{lang.t("No session locations/factions yet.")}</div>
			)}
		</TodoSection>
	);
}

interface SessionScenesSectionProps {
	view: SessionController;
	scenes: SessionScene[];
	simplifiedNotesEnabled: boolean;
	onBulkCollapse: (collapsed: boolean) => void;
	onToggleNoteAiIgnored: (
		sceneId: SessionResourceId,
		noteId: SessionResourceId,
		ignored: boolean,
	) => void;
	getEncounterName: (scene: SessionScene) => string;
}

interface SessionSceneItemProps
	extends Omit<SessionScenesSectionProps, "onBulkCollapse" | "scenes"> {
	scene: SessionScene;
	number: number;
}

function SessionSceneItem({
	view,
	scene,
	number,
	simplifiedNotesEnabled,
	onToggleNoteAiIgnored,
	getEncounterName,
}: SessionSceneItemProps) {
	return (
		<div id={makeDomId("session", "scene", scene.id)}>
			<SceneCard
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
				onSceneNoteTitleChange={(noteId, title) =>
					view.handleSceneNoteTitleChange(scene.id, noteId, title)
				}
				onSceneNoteChange={(noteId, text) =>
					view.handleSceneNoteChange(scene.id, noteId, text)
				}
				onSceneNotesReorder={(notes) =>
					view.handleSceneNotesReorder(scene.id, notes)
				}
				onSceneNoteAiIgnoredChange={(noteId, ignored) =>
					onToggleNoteAiIgnored(scene.id, noteId, ignored)
				}
				onSceneNoteToggleCollapse={(noteId) =>
					view.handleSceneToggleNoteCollapse(scene.id, noteId)
				}
				onSceneNoteDelete={(noteId) =>
					view.handleSceneDeleteNote(scene.id, noteId)
				}
				simplifiedNotesEnabled={simplifiedNotesEnabled}
			/>
		</div>
	);
}

function SessionScenesSection(props: SessionScenesSectionProps) {
	const { view, scenes, onBulkCollapse } = props;
	return (
		<TodoSection
			title={lang.t("Scenes")}
			action={
				<div className="SessionView__sectionActions">
					<BulkCollapseButton items={scenes} onChange={onBulkCollapse} />
					<Button variant="primary" size={Button.SIZES.SMALL} onClick={view.addScene} icon="plus" iconSize={16} className="SessionView__mobileIconOnly">
						{lang.t("Add")}
					</Button>
				</div>
			}
		>
			{scenes.length > 0 && (
				<DraggableList
					items={scenes}
					onReorder={(nextScenes) => view.updateData("scenes", nextScenes)}
					keyExtractor={(scene) => scene.id}
					renderItem={(scene) => (
						<SessionSceneItem
							{...props}
							scene={scene}
							number={scenes.findIndex((item) => item.id === scene.id) + 1}
						/>
					)}
				/>
			)}
		</TodoSection>
	);
}

interface SessionFloatingActionsProps {
	view: SessionController;
	isGlobalSearchOpen: boolean;
	onCloseGlobalSearch: () => void;
}

function SessionFloatingActions({
	view,
	isGlobalSearchOpen,
	onCloseGlobalSearch,
}: SessionFloatingActionsProps) {
	return (
		<>
			<Tooltip content={lang.t("Preparation checklist")} className="SessionView__checklistToggle">
				<button onClick={() => view.setIsChecklistOpen(true)}>
					<Icon name="list" size={28} />
					{view.progress < 100 && <span className="SessionView__checklistBadge" />}
				</button>
			</Tooltip>
			{isGlobalSearchOpen && <GlobalSearchModal onCancel={onCloseGlobalSearch} />}
		</>
	);
}

function getSessionViewList<T>(value: T[] | null | undefined): T[] {
	return value || [];
}

function getSessionPageDataRecord(session: SessionController["session"]) {
	return session || {};
}

interface SessionHashNavigationOptions {
	sessionId: string | null;
	isSessionNotesCollapsed: boolean;
	sessionNotesForRender: readonly SharedNote[];
	sessionLocations: readonly SessionPageEntity[];
	sessionNpcs: readonly SessionPageEntity[];
	scenes: readonly SessionScene[];
	onToggleSectionCollapse: (section: string) => void;
}

function useSessionHashNavigation({
	sessionId,
	isSessionNotesCollapsed,
	sessionNotesForRender,
	sessionLocations,
	sessionNpcs,
	scenes,
	onToggleSectionCollapse,
}: SessionHashNavigationOptions): void {
	useEffect(() => {
		if (shouldExpandSessionNotesFromHash(
			window.location.hash,
			isSessionNotesCollapsed,
		)) {
			onToggleSectionCollapse("Notes");
		}
		const timer = window.setTimeout(() => scrollToHashTarget(), 140);
		return () => window.clearTimeout(timer);
	}, [
		isSessionNotesCollapsed,
		onToggleSectionCollapse,
		scenes,
		sessionId,
		sessionLocations,
		sessionNotesForRender,
		sessionNpcs,
	]);
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
							view={view}
							notes={viewModel.notes}
							renderableNotes={sessionNotesForRender}
							hasData={hasSessionNotesData}
							isCollapsed={isSessionNotesCollapsed}
							onBulkCollapse={handleBulkSessionNotesCollapse}
							onToggleAiIgnored={toggleSessionNoteAiIgnored}
						/>
						<SessionNpcSection
							view={view}
							onBulkCollapse={handleBulkSessionEntitiesCollapse}
							onToggleAiIgnored={toggleSessionEntityAiIgnored}
						/>

						<SessionLocationSection
							view={view}
							onBulkCollapse={handleBulkSessionEntitiesCollapse}
							onToggleAiIgnored={toggleSessionEntityAiIgnored}
						/>
						<SessionScenesSection
							view={view}
							scenes={scenes}
							simplifiedNotesEnabled={simplifiedNotesEnabled}
							onBulkCollapse={handleBulkScenesCollapse}
							onToggleNoteAiIgnored={toggleSceneNoteAiIgnored}
							getEncounterName={(scene) =>
								lang.t(viewModel.findEncounterName(scene))
							}
						/>

						<TodoSection title={lang.t("Session result")}>
							<EditableField
								type="textarea"
								className="field__result"
								enableHistory={false}
								placeholder={lang.t("Summary of what actually happened...")}
							value={String(sessionData.result_text || "")}
								onChange={(e) => view.updateData("result_text", e.target.value)}
							/>
						</TodoSection>
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
					view={view}
					isGlobalSearchOpen={isGlobalSearchOpen}
					onCloseGlobalSearch={() => setIsGlobalSearchOpen(false)}
				/>
			</Panel>
		</EntityLinkResolverContext.Provider>
	);
}

export default SessionView;

interface SceneCardProps {
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
	onSceneNoteTitleChange: (noteId: SessionResourceId, title: string) => void;
	onSceneNoteChange: (noteId: SessionResourceId, text: string) => void;
	onSceneNotesReorder: (notes: SharedNote[]) => void;
	onSceneNoteAiIgnoredChange: (
		noteId: SessionResourceId,
		ignored: boolean,
	) => void;
	onSceneNoteToggleCollapse: (noteId: SessionResourceId) => void;
	onSceneNoteDelete: (noteId: SessionResourceId) => void;
	simplifiedNotesEnabled: boolean;
}

function SceneCard(props: SceneCardProps) {
	const encounterLabel = props.hasEncounter
		? props.encounterName
		: lang.t("New encounter");
	return (
		<div className="SceneCard">
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
				<div className="SceneCard__content">
					<div className="SceneCard__text_side">
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
							renderNoteCard={(note, isLast) => (
								<SessionNoteCard
									note={note}
									isLast={isLast}
									campaignSlug={props.campaignSlug}
									enableHistory={false}
									onToggleCollapse={props.onSceneNoteToggleCollapse}
									onTitleChange={props.onSceneNoteTitleChange}
									onTextChange={props.onSceneNoteChange}
									onDelete={props.onSceneNoteDelete}
								/>
							)}
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
