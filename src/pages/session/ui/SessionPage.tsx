import {
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
	type RefObject,
} from "react";

import { Button, Icon, Panel, Tooltip } from "../../../shared/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import { DraggableList } from "../../../shared/ui/index.js";
import { Modal } from "../../../features/modal/index.js";
import {
	AiContextIgnoreButton,
	BulkCollapseButton,
	getAiIgnoredNoteListProps,
	NoteCard,
} from "../../../features/notes/ui/index.js";
import { CollapseToggleButton } from "../../../shared/ui/index.js";
import TodoSection from "./components/TodoSection.tsx";
import TodoItem from "./components/TodoItem.tsx";
import SceneCardHeader from "./components/SceneCardHeader.tsx";
import SceneCardMedia from "./components/SceneCardMedia.tsx";
import SceneCardFields from "./components/SceneCardFields.tsx";
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
import { navigateTo, useAppSelector } from "../../../shared/model/index.js";
import {
	makeDomId,
	scrollToHashTarget,
	shouldOpenInNewTabFromEvent,
} from "../../../shared/lib/index.js";
import { renderMentionText } from "../../../features/rich-content/index.js";
import {
	EntityLinkResolverContext,
	type EntityLinkModalState,
	type EntityLinkResolver,
} from "../../../features/entity-link/index.js";
import {
	findEntityByName,
} from "../../../entities/campaign/index.js";
import { classNames } from "../../../shared/lib/index.js";
import type { SharedNote } from "../../../shared/lib/index.js";
import type { SessionResourceId } from "../../../features/session-editor/index.js";
import {
	getSceneNotesWithCollapsedState,
	getSessionEncounterLinks,
	getSessionScopeImportCopy,
	getSessionSectionCollapsed,
	hasSessionNoteContent,
	shouldExpandSessionNotesFromHash,
	type SessionEncounterLink,
	type SessionScopeImportCopy,
} from "../model/sessionPagePresentation.ts";
import {
	getSessionEntityDisplayName,
	normalizeSessionEntity,
	type SessionEntityType,
	type SessionPageEntity,
} from "../model/sessionEntityModel.ts";
import type { SceneCardFieldDefinition } from "./components/SceneCardFields.tsx";

function isSessionEntityId(value: unknown): value is string | number {
	return typeof value === "string" || typeof value === "number";
}

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

function SessionHeader({
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
										onClick={(event) => onOpenEncounter(encounter.id, event)}
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
			<div
				ref={actionsRef}
				className={classNames("SessionView__headerActions", {
					is_open: isActionsOpen,
				})}
			>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="menu"
					className="SessionView__headerActionsToggle"
					onClick={onToggleActions}
					title={lang.t("Session actions")}
				/>
				<div className="SessionView__headerActionsMenu">
					<Button variant="ghost" size={Button.SIZES.SMALL} icon="search" onClick={onOpenSearch} title={lang.t("Global search")}>
						{lang.t("Search")}
					</Button>
					<Button variant="ghost" size={Button.SIZES.SMALL} icon="undo" onClick={onUndo} disabled={!canUndo || isSaving} title={lang.t("Undo (Ctrl+Z)")} />
					<Button variant="ghost" size={Button.SIZES.SMALL} icon="redo" onClick={onRedo} disabled={!canRedo || isSaving} title={lang.t("Redo (Ctrl+Y)")} />
					<Button variant="danger" size={Button.SIZES.SMALL} icon="trash" onClick={onDelete} title={lang.t("Delete session")} />
				</div>
			</div>
		</div>
	);
}

type SessionController = ReturnType<typeof useSessionView>;
type RenderableSessionNote = SharedNote & {
	_isVirtual?: boolean;
	_renderKey?: string | number;
};

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
							<NoteCard
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

interface SessionChecklistOverlayProps {
	view: SessionController;
	sessionData: Record<string, unknown>;
}

function SessionChecklistOverlay({
	view,
	sessionData,
}: SessionChecklistOverlayProps) {
	if (!view.isChecklistOpen) return null;
	const close = () => view.setIsChecklistOpen(false);
	return (
		<Modal title={lang.t("Preparation checklist")} onConfirm={close} onCancel={close} showFooter={false}>
			<div className="SessionView__checklistModal">
				<div className="SessionView__progressWrap">
					<div className="ProgressBar__label">
						<span>{lang.t("Preparation progress")}</span>
						<span>{view.progress}%</span>
					</div>
					<div className="ProgressBar">
						<div className="ProgressBar__fill" style={{ width: `${view.progress}%` }} />
					</div>
				</div>
				{view.checklistItems.map((item) => (
					<TodoItem
						key={item.id}
						checked={Boolean(sessionData[`${item.id}_check`])}
						onChange={(checked) => view.updateData(`${item.id}_check`, checked, true)}
						title={item.label}
						note={item.note}
					/>
				))}
			</div>
		</Modal>
	);
}

interface SessionScopeImportOverlayProps {
	view: SessionController;
	modal: NonNullable<SessionController["scopeImportModal"]> | null;
	copy: SessionScopeImportCopy | null;
	type: SessionEntityType;
}

function SessionScopeImportOverlay({
	view,
	modal,
	copy,
	type,
}: SessionScopeImportOverlayProps) {
	if (!modal || !copy) return null;
	return (
		<Modal title={copy.title} onConfirm={view.closeScopeImportModal} onCancel={view.closeScopeImportModal} showFooter={false}>
			<div className="SessionView__scopeImportList">
				{modal.isLoading && <div className="muted">{lang.t("Loading...")}</div>}
				{!modal.isLoading && modal.items.length === 0 && (
					<div className="muted">{copy.emptyText}</div>
				)}
				{!modal.isLoading &&
					modal.items.map((entity) => {
						const name = getSessionEntityDisplayName(type, entity, lang.t("Untitled"));
						return (
							<div key={entity.slug || entity.id || name} className="SessionView__scopeImportItem">
								<span>{renderMentionText(name)}</span>
								<Button variant="primary" size={Button.SIZES.SMALL} icon="import" onClick={() => view.moveCampaignEntityToSession(type, entity)}>
									{lang.t("Move to session")}
								</Button>
							</div>
						);
					})}
			</div>
		</Modal>
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

function SessionView() {
	const sessionId = useAppSelector(
		(state) => state.navigation.activeSessionFileName,
	);
	const view = useSessionView();
	const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
	const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
	const headerActionsRef = useRef<HTMLDivElement | null>(null);
	const session = view.session;
	const simplifiedNotesEnabled = useAppSelector(
		(state) => state.ui.simplifiedNotes,
	);
	const {
		campaignSlug: scopedCampaignSlug,
		handleSessionLocationChange,
		handleSessionLocationDelete,
		handleSessionNpcChange,
		handleSessionNpcDelete,
		sessionLocations,
		sessionNpcs,
	} = view;
	const parentEntityLinks = useContext(EntityLinkResolverContext);
	const sessionScopedEntityLinks = useMemo<EntityLinkResolver>(() => {
		const scopedEntities = [
			...sessionNpcs.map((entity) => ({
				entity: { ...entity, _scope: "session" },
				type: "npc",
				scope: "session",
			})),
			...sessionLocations.map((entity) => ({
				entity: { ...entity, _scope: "session" },
				type: "locations",
				scope: "session",
			})),
		];
		const findCurrentSessionEntity = (modalState: EntityLinkModalState) => {
			const items =
				modalState.type === "locations" ? sessionLocations : sessionNpcs;
			return (
				items.find(
					(entity) => String(entity.id) === String(modalState.entity?.id),
				) || modalState.entity
			);
		};

		return {
			resolveEntityByName(name: string) {
				return (
					findEntityByName(scopedEntities, name) ||
					parentEntityLinks?.resolveEntityByName?.(name) ||
					null
				);
			},
			renderModalContent(modalState: EntityLinkModalState, onClose: () => void) {
				if (modalState.scope !== "session") {
					return parentEntityLinks?.renderModalContent?.(modalState, onClose);
				}

				const entity = findCurrentSessionEntity(modalState);
				if (modalState.type === "locations") {
					const location = normalizeSessionEntity("locations", entity);
					return (
						<LocationCard
							key={location.id}
							location={{ ...location, collapsed: false }}
							onChange={(id, updatedEntity) => {
								if (isSessionEntityId(id)) {
									handleSessionLocationChange(id, updatedEntity);
								}
							}}
							onDelete={(id) => {
								if (isSessionEntityId(id)) handleSessionLocationDelete(id);
								onClose();
							}}
							onToggleCollapse={null}
							campaignSlug={scopedCampaignSlug}
							enableHistory={false}
							viewMode="modal"
						/>
					);
				}

				const npc = normalizeSessionEntity("npc", entity);
				return (
					<CharacterCard
						key={npc.id}
						character={{ ...npc, collapsed: false }}
						onChange={(id, updatedEntity) => {
							if (isSessionEntityId(id)) {
								handleSessionNpcChange(id, updatedEntity);
							}
						}}
						onDelete={(id) => {
							if (isSessionEntityId(id)) handleSessionNpcDelete(id);
							onClose();
						}}
						onToggleCollapse={null}
						campaignSlug={scopedCampaignSlug}
						enableHistory={false}
						type="npc"
						viewMode="modal"
					/>
				);
			},
		};
	}, [
		handleSessionLocationChange,
		handleSessionLocationDelete,
		handleSessionNpcChange,
		handleSessionNpcDelete,
		parentEntityLinks,
		scopedCampaignSlug,
		sessionLocations,
		sessionNpcs,
	]);

	const sessionData = session?.data ?? {};
	const viewModel = useMemo(
		() =>
			new SessionViewModel({
				...(session || {}),
				data: sessionData,
				isSaving: view.isSaving,
			}),
		[session, sessionData, view.isSaving],
	);
	const hasSessionNotesData = hasSessionNoteContent(viewModel.notes);
	const sessionNotesForRender = getNotesForRender(viewModel.notes || [], {
		simplifiedNotes: simplifiedNotesEnabled,
	});
	const scenes = useMemo(() => viewModel.scenes || [], [viewModel]);
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

	useEffect(() => {
		if (
			shouldExpandSessionNotesFromHash(
				window.location.hash,
				isSessionNotesCollapsed,
			)
		) {
			handleToggleSectionCollapse("Notes");
		}
		const timer = window.setTimeout(() => scrollToHashTarget(), 140);
		return () => window.clearTimeout(timer);
	}, [
		isSessionNotesCollapsed,
		sessionId,
		sessionNotesForRender,
		handleToggleSectionCollapse,
		sessionLocations,
		sessionNpcs,
		scenes,
	]);

	useEffect(() => {
		if (!isHeaderActionsOpen) return undefined;

		const handlePointerDown = (event: PointerEvent) => {
			if (
			event.target instanceof Node &&
			headerActionsRef.current?.contains(event.target)
			) return;
			setIsHeaderActionsOpen(false);
		};

		document.addEventListener("pointerdown", handlePointerDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
		};
	}, [isHeaderActionsOpen]);

	if (!session) return null;

	const openEncounterFromQuickAccess = (
		encounterId: SessionDomainId,
		event: MouseEvent<HTMLButtonElement>,
	) => {
		navigateTo(
			view.campaignSlug,
			sessionId,
			false,
			encounterId,
			shouldOpenInNewTabFromEvent(event),
		);
	};

	const scopeImportModal = view.scopeImportModal;
	const scopeImportType: SessionEntityType =
		scopeImportModal?.type === "locations" ? "locations" : "npc";
	const scopeImportCopy = scopeImportModal
		? getSessionScopeImportCopy(scopeImportType, lang.t)
		: null;
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

				<SessionChecklistOverlay view={view} sessionData={sessionData} />
				<SessionScopeImportOverlay
					view={view}
					modal={scopeImportModal}
					copy={scopeImportCopy}
					type={scopeImportType}
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

type SceneNotesProps = Pick<
	SceneCardProps,
	| "campaignSlug"
	| "onSceneNoteAiIgnoredChange"
	| "onSceneNoteChange"
	| "onSceneNoteDelete"
	| "onSceneNotesReorder"
	| "onSceneNoteTitleChange"
	| "onSceneNoteToggleCollapse"
	| "onToggleNotesCollapse"
	| "scene"
	| "simplifiedNotesEnabled"
>;

function SceneNotes(props: SceneNotesProps) {
	const sceneNotes = props.scene.notes || [];
	const sceneNotesForRender = getNotesForRender(sceneNotes, {
		simplifiedNotes: props.simplifiedNotesEnabled,
	});
	const hasSceneNotesData = hasSessionNoteContent(sceneNotes);
	const isSceneNotesCollapsed = getSessionSectionCollapsed(
		hasSceneNotesData,
		props.scene.isNotesCollapsed,
	);
	const sceneNotesActionShouldCollapse = sceneNotesForRender.some(
		(note) => !note._isVirtual && !note.collapsed,
	);
	const handleBulkSceneNotesCollapse = () => {
		props.onSceneNotesReorder(
			getSceneNotesWithCollapsedState(
				sceneNotes,
				sceneNotesActionShouldCollapse,
			),
		);
	};

	return (
		<div className="SceneCard__notes">
							<div className="SceneCard__notes_headerRow">
								<div
									className="SceneCard__notes_header"
									onClick={
										hasSceneNotesData ? props.onToggleNotesCollapse : undefined
									}
								>
									{hasSceneNotesData && (
										<CollapseToggleButton
											size={Button.SIZES.SMALL}
											collapsed={isSceneNotesCollapsed}
											onClick={props.onToggleNotesCollapse}
										/>
									)}
									<label>{lang.t("Scene notes")}</label>
								</div>
								{!isSceneNotesCollapsed && sceneNotes.length > 0 && (
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="chevron"
										iconSize={16}
										onClick={handleBulkSceneNotesCollapse}
										title={lang.t(
											sceneNotesActionShouldCollapse
												? "Collapse all items"
												: "Expand all items",
										)}
									>
										{lang.t(
											sceneNotesActionShouldCollapse
												? "Collapse all"
												: "Expand all",
										)}
									</Button>
								)}
							</div>
							{!isSceneNotesCollapsed && (
								<DraggableList
									items={sceneNotesForRender}
									className="SceneCard__notes_list"
									onReorder={props.onSceneNotesReorder}
									{...getAiIgnoredNoteListProps(
										props.onSceneNoteAiIgnoredChange,
									)}
									renderItem={(note, isDragging, index) => (
										<NoteCard
											note={note}
											isLast={index === sceneNotesForRender.length - 1}
											campaignSlug={props.campaignSlug}
											enableHistory={false}
											onToggleCollapse={props.onSceneNoteToggleCollapse}
											onTitleChange={props.onSceneNoteTitleChange}
											onTextChange={props.onSceneNoteChange}
											onDelete={props.onSceneNoteDelete}
										/>
									)}
								/>
							)}
		</div>
	);
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
						<SceneNotes {...props} />
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
