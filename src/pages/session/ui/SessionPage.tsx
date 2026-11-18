import {
	useCallback,
	useContext,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
} from "react";

import {
	Button,
	Panel,
	SectionTabs,
	usePointerDownOutsideDismissal,
} from "../../../shared/ui/index.js";
import { useSimplifiedNotesEnabled } from "../../../features/notes/ui/index.js";
import { EntityMoveDialog } from "../../../features/campaign-entity/ui/index.js";
import SessionHeader from "./components/SessionHeader.tsx";
import SessionChecklistOverlay from "./components/SessionChecklistOverlay.tsx";
import SessionEntitySection from "./components/SessionEntitySection.tsx";
import SessionFloatingActions from "./components/SessionFloatingActions.tsx";
import SessionNotesSection from "./components/SessionNotesSection.tsx";
import SessionResultSection from "./components/SessionResultSection.tsx";
import SessionScenesSection from "./components/SessionScenesSection.tsx";
import SessionNoteCard from "./components/SessionNoteCard.tsx";
import SessionSceneItem from "./components/SessionSceneItem.tsx";
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
import { useSessionSceneSelection } from "../model/useSessionSceneSelection.ts";
import {
	SessionViewModel,
	type SessionDomainId,
	type SessionScene,
} from "../../../entities/session/index.js";
import { lang } from "../../../shared/lib/index.js";
import { useUrlSection } from "../../../shared/lib/index.js";
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
	type EntityLinkModalState,
	type EntityLinkResolver,
} from "../../../features/entity-link/index.js";
import {
	findEntityByName,
} from "../../../entities/campaign/index.js";
import type { SessionResourceId } from "../../../features/session-editor/index.js";
import {
	makeHistoryTargetId,
	matchesHistoryTargetId,
} from "../../../entities/history/index.js";
import {
	getNextSessionSectionFromArrowKey,
	getSessionEncounterLinks,
	getSessionPageData,
	getSessionScopeImportPresentation,
	getSessionSectionCollapsed,
	hasSessionNoteContent,
	isSessionEditableTarget,
} from "../model/sessionPagePresentation.ts";
import type { SessionEntityType, SessionPageEntity } from "../model/sessionEntityModel.ts";
import { useSessionPageRuntime } from "../model/SessionPageRuntime.tsx";

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

function getSessionViewList<T>(value: T[] | null | undefined): T[] {
	return value || [];
}

function getSessionPageDataRecord(session: SessionController["session"]) {
	return session || {};
}

function SessionView() {
	const tabsId = useId();
	const { activeSessionFileName: sessionId, navigateToEncounter } =
		useSessionPageRuntime();
	const view = useSessionView();
	const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
	const [createdEntity, setCreatedEntity] = useState<{ type: "npc" | "locations"; id: string | number; campaign: string; session: string | null } | null>(null);
	const [moveTarget, setMoveTarget] = useState<{ type: "npc" | "locations"; entity: SessionPageEntity } | null>(null);
	const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
	const [activeSection, setActiveSection, revealSection] = useUrlSection(
		["scenes", "notes", "entities", "result"] as const, "scenes",
	);
	const lastRevealedHash = useRef("");
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
	const { selectedScene, selectScene } = useSessionSceneSelection(scenes, sessionId);
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
	const revealSessionHistoryTarget = useCallback((hash: string) => {
		if (hash !== lastRevealedHash.current) {
			lastRevealedHash.current = hash;
			if (hash.includes("session-scene")) revealSection("scenes");
			else if (hash.includes("session-note")) revealSection("notes");
			else if (hash.includes("session-npc") || hash.includes("session-location")) revealSection("entities");
			else if (hash.includes("session-result")) revealSection("result");
		}
		const sessionNote = sessionNotes.find((note) =>
			matchesHistoryTargetId(hash, "session", "note", note.id),
		);
		if (sessionNote && (isSessionNotesCollapsed || sessionNote.collapsed)) {
			view.updateSession({
				data: {
					...sessionData,
					isNotesCollapsed: false,
					notes: sessionNotes.map((note) =>
						note.id === sessionNote.id
							? { ...note, collapsed: false }
							: note,
					),
				},
			}, true);
			return;
		}

		const entityGroups = [
			{
				kind: "npc" as const,
				items: view.sessionNpcs,
				onChange: view.handleSessionNpcChange,
			},
			{
				kind: "location" as const,
				items: view.sessionLocations,
				onChange: view.handleSessionLocationChange,
			},
		];
		for (const group of entityGroups) {
			for (const entity of group.items) {
				const targetNote = entity.notes.find((note) =>
					matchesHistoryTargetId(
						hash,
						"session",
						`${group.kind}-note`,
						entity.id,
						note.id,
					),
				);
				const targetsEntity = matchesHistoryTargetId(
					hash,
					"session",
					group.kind,
					entity.id,
				);
				if (!targetNote && !targetsEntity) continue;
				if (
					!entity.collapsed &&
					(!targetNote || (!entity.isNotesCollapsed && !targetNote.collapsed))
				) {
					return;
				}
				group.onChange(entity.id, {
					...entity,
					collapsed: false,
					...(targetNote
						? {
							isNotesCollapsed: false,
							notes: entity.notes.map((note) =>
								note.id === targetNote.id
									? { ...note, collapsed: false }
									: note,
							),
						}
						: {}),
				});
				return;
			}
		}

		const scene = scenes.find((item) =>
			matchesHistoryTargetId(hash, "session", "scene", item.id),
		);
		const sceneWithNote = scenes.find((item) =>
			(item.notes || []).some((note) =>
				matchesHistoryTargetId(
					hash,
					"session",
					"scene-note",
					item.id,
					note.id,
				),
			),
		);
		const targetScene = sceneWithNote || scene;
		if (!targetScene) return;
		const targetNote = (sceneWithNote?.notes || []).find((note) =>
			matchesHistoryTargetId(
				hash,
				"session",
				"scene-note",
				targetScene.id,
				note.id,
			),
		);
		if (
			!targetScene.collapsed &&
			(!targetNote || (!targetScene.isNotesCollapsed && !targetNote.collapsed))
		) return;
		view.updateData(
			"scenes",
			scenes.map((item) =>
				item.id === targetScene.id
					? {
						...item,
						collapsed: false,
						...(targetNote
							? {
								isNotesCollapsed: false,
								notes: (item.notes || []).map((note) =>
									note.id === targetNote.id
										? { ...note, collapsed: false }
										: note,
								),
							}
							: {}),
					}
					: item,
			),
			true,
		);
	}, [
		isSessionNotesCollapsed,
		revealSection,
		scenes,
		sessionData,
		sessionNotes,
		view.handleSessionLocationChange,
		view.handleSessionNpcChange,
		view.sessionLocations,
		view.sessionNpcs,
		view.updateData,
		view.updateSession,
	]);
	useSessionHashNavigation({
		sessionId,
		isSessionNotesCollapsed,
		sessionNotesForRender,
		sessionLocations: view.sessionLocations,
		sessionNpcs: view.sessionNpcs,
		scenes,
		onToggleSectionCollapse: handleToggleSectionCollapse,
		onToggleSceneCollapse: view.toggleSceneCollapse,
		onToggleSceneNotesCollapse: view.handleToggleSceneNotesCollapse,
		onRevealHistoryTarget: revealSessionHistoryTarget,
	});
	usePointerDownOutsideDismissal({
		containerRef: headerActionsRef,
		isOpen: isHeaderActionsOpen,
		setIsOpen: setIsHeaderActionsOpen,
	});

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target instanceof HTMLElement ? event.target : null;
			const isInteractiveOrEditable =
				isSessionEditableTarget(target) ||
				target?.tagName === "SELECT" ||
				Boolean(target?.closest("[contenteditable='true'], [role='tablist']"));
			const nextSection = getNextSessionSectionFromArrowKey({
				key: event.key,
				ctrlKey: event.ctrlKey,
				metaKey: event.metaKey,
				altKey: event.altKey,
				shiftKey: event.shiftKey,
				defaultPrevented: event.defaultPrevented,
				isEditableTarget: isInteractiveOrEditable,
				hasOpenModal: Boolean(document.querySelector(".Modal__overlay")),
				activeSection,
			});
			if (!nextSection) return;
			event.preventDefault();
			setActiveSection(nextSection);
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [activeSection, setActiveSection]);

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
	const getEncounterName = (scene: SessionScene) =>
		lang.t(viewModel.findEncounterName(scene));

	return (
		<EntityLinkResolverContext.Provider value={sessionScopedEntityLinks}>
			<Panel
				className="SessionView"
				data-history-focus-id={makeHistoryTargetId("session", "summary")}
			>
				<SessionHeader
					sessionName={session.name}
					encounters={sessionEncounters}
					isActionsOpen={isHeaderActionsOpen}
					actionsRef={headerActionsRef}
					isSaving={view.isSaving}
					canUndo={view.canUndo}
					canRedo={view.canRedo}
					isHistoryRestoring={view.isHistoryRestoring}
					undoTitle={view.undoLabel}
					redoTitle={view.redoLabel}
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
					<SectionTabs idPrefix={tabsId} label={lang.t("Session sections")} value={activeSection} onChange={setActiveSection} items={[
						{ id: "scenes", label: lang.t("Preparation") },
						{ id: "notes", label: lang.t("Notes") },
						{ id: "entities", label: lang.t("Characters") },
						{ id: "result", label: lang.t("Summary") },
					]} />
					<div className="SessionView__todoList">
						<div role="tabpanel" id={`${tabsId}-panel-notes`} aria-labelledby={`${tabsId}-tab-notes`} hidden={activeSection !== "notes"}>
						<div
							id={makeDomId("session", "notes")}
							data-history-focus-id={makeHistoryTargetId("session", "notes")}
						>
						<SessionNotesSection
							key={`${view.campaignSlug}:${sessionId}:notes`}
							renderableNotes={sessionNotesForRender}
							onToggleAiIgnored={toggleSessionNoteAiIgnored}
							onReorder={(nextNotes) =>
								view.updateData("notes", sanitizeNotesForSave(nextNotes))
							}
							renderItem={(note, _isDragging, index) => (
								<div
									id={makeDomId("session", "note", note.id)}
									data-history-focus-id={makeHistoryTargetId(
										"session",
										"note",
										note.id,
									)}
								>
									<SessionNoteCard
										note={note}
										isLast={index === sessionNotesForRender.length - 1}
										campaignSlug={view.campaignSlug}
										enableHistory={false}
										collapsible={false}
										onToggleCollapse={view.handleToggleNoteCollapse}
										onTitleChange={view.handleNoteTitleChange}
										onTextChange={view.handleNoteChange}
										onDelete={view.handleDeleteNote}
									/>
								</div>
							)}
						/>
						</div>
						</div>
						<div role="tabpanel" id={`${tabsId}-panel-entities`} aria-labelledby={`${tabsId}-tab-entities`} hidden={activeSection !== "entities"} className="SessionView__entities">
						<SessionEntitySection
							key={`${view.campaignSlug}:${sessionId}:npc`}
							selectionRequest={createdEntity?.type === "npc" && createdEntity.campaign === view.campaignSlug && createdEntity.session === sessionId ? createdEntity : null}
							historyFocusId={makeHistoryTargetId(
								"session",
								"npc-section",
							)}
							title={lang.t("Session NPCs")}
							actions={
								<>
									<CreateCharacterButton
										buttonVariant="primary"
										campaignSlug={view.campaignSlug}
										entityType="npc"
										buttonLabel={lang.t("New session NPC")}
										buttonClassName="SessionEntitySection__mobileIconOnly"
										onCreate={async (payload) => { const entity = await view.handleCreateSessionNpc(payload); setCreatedEntity({ type: "npc", id: entity.id, campaign: view.campaignSlug, session: sessionId }); }}
									/>
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="import"
										className="SessionEntitySection__mobileIconOnly"
										onClick={() => view.openCampaignScopeImport("npc")}
									>
										{lang.t("Move from campaign")}
									</Button>
								</>
							}
							emptyText={lang.t("No session NPCs yet.")}
							items={view.sessionNpcs}
							listVariant="person"
							onReorder={view.handleSessionNpcsReorder}
							onToggleAiIgnored={(entityId, ignored) =>
								toggleSessionEntityAiIgnored("npc", entityId, ignored)
							}
							renderItem={(npc) => (
								<div
									id={makeDomId("session", "npc", npc.id)}
									data-history-focus-id={makeHistoryTargetId(
										"session",
										"npc",
										npc.id,
									)}
								>
									<CharacterCard
										character={npc}
										onChange={view.handleSessionNpcChange}
										onDelete={view.handleSessionNpcDelete}
										campaignSlug={view.campaignSlug}
										enableHistory={false}
										type="npc"
										historyScope="session"
										headerActions={
											<Button
												variant="ghost"
												size={Button.SIZES.SMALL}
												icon="export"
												iconSize={14}
												onClick={() => setMoveTarget({ type: "npc", entity: npc })}
												title={lang.t("Move")}
											>{lang.t("Move")}</Button>
										}
									/>
								</div>
							)}
						/>

						<SessionEntitySection
							key={`${view.campaignSlug}:${sessionId}:locations`}
							selectionRequest={createdEntity?.type === "locations" && createdEntity.campaign === view.campaignSlug && createdEntity.session === sessionId ? createdEntity : null}
							historyFocusId={makeHistoryTargetId(
								"session",
								"location-section",
							)}
							title={lang.t("Session locations/factions")}
							actions={
								<>
									<CreateLocationButton
										buttonVariant="primary"
										campaignSlug={view.campaignSlug}
										buttonLabel={lang.t("New session location/faction")}
										buttonClassName="SessionEntitySection__mobileIconOnly"
										onCreate={async (payload) => { const entity = await view.handleCreateSessionLocation(payload); setCreatedEntity({ type: "locations", id: entity.id, campaign: view.campaignSlug, session: sessionId }); }}
									/>
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="import"
										className="SessionEntitySection__mobileIconOnly"
										onClick={() => view.openCampaignScopeImport("locations")}
									>
										{lang.t("Move from campaign")}
									</Button>
								</>
							}
							emptyText={lang.t("No session locations/factions yet.")}
							items={view.sessionLocations}
							listVariant="location"
							onReorder={view.handleSessionLocationsReorder}
							onToggleAiIgnored={(entityId, ignored) =>
								toggleSessionEntityAiIgnored("locations", entityId, ignored)
							}
							renderItem={(location) => (
								<div
									id={makeDomId("session", "location", location.id)}
									data-history-focus-id={makeHistoryTargetId(
										"session",
										"location",
										location.id,
									)}
								>
									<LocationCard
										location={location}
										onChange={view.handleSessionLocationChange}
										onDelete={view.handleSessionLocationDelete}
										campaignSlug={view.campaignSlug}
										enableHistory={false}
										historyScope="session"
										headerActions={
											<Button
												variant="ghost"
												size={Button.SIZES.SMALL}
												icon="export"
												iconSize={14}
												onClick={() => setMoveTarget({ type: "locations", entity: location })}
												title={lang.t("Move")}
											>{lang.t("Move")}</Button>
										}
									/>
								</div>
							)}
						/>
						</div>
						<div role="tabpanel" id={`${tabsId}-panel-scenes`} aria-labelledby={`${tabsId}-tab-scenes`} hidden={activeSection !== "scenes"}>
						<SessionScenesSection
							scenes={scenes}
							onAddScene={view.addScene}
							onReorder={(nextScenes) => view.updateData("scenes", nextScenes)}
							selectedScene={selectedScene}
							onOpenScene={selectScene}
							reference={
								<section className="SessionReferenceCard"><h3>{lang.t("In this session")}</h3>
									<p className="WorkspaceEyebrow">{lang.t("Locations/Factions")}</p>
									{view.sessionLocations.length === 0 && <p className="muted">{lang.t("No session locations/factions yet.")}</p>}
									{view.sessionLocations.map((location) => <p key={location.id ?? location.slug}>{String(location.name || location.title || lang.t("Untitled"))}</p>)}
									<p className="WorkspaceEyebrow">{lang.t("NPC")}</p>
									{view.sessionNpcs.length === 0 && <p className="muted">{lang.t("No session NPCs yet.")}</p>}
									{view.sessionNpcs.map((npc) => <p key={npc.id ?? npc.slug}>{String(npc.name || [npc.firstName, npc.lastName].filter(Boolean).join(" ") || lang.t("Untitled"))}</p>)}
									<button type="button" className="WorkspaceTextLink" onClick={() => setActiveSection("entities")}>{lang.t("View all")} →</button>
								</section>
							}
							renderScene={(scene) => (
							<SessionSceneItem
								scene={scene}
								number={scenes.findIndex((item) => item.id === scene.id) + 1}
								campaignSlug={view.campaignSlug}
								simplifiedNotesEnabled={simplifiedNotesEnabled}
								onRemove={view.removeScene}
								onOpenEncounter={view.handleOpenEncounter}
								onImageChange={(sceneId, imageUrl) =>
									view.updateScene(sceneId, "imageUrl", imageUrl, true)
								}
								onUpdateField={view.updateScene}
								onNotesReorder={view.handleSceneNotesReorder}
								onToggleNoteAiIgnored={toggleSceneNoteAiIgnored}
								onToggleNoteCollapse={view.handleSceneToggleNoteCollapse}
								onNoteTitleChange={view.handleSceneNoteTitleChange}
								onNoteChange={view.handleSceneNoteChange}
								onNoteDelete={view.handleSceneDeleteNote}
								getEncounterName={getEncounterName}
								/>
							)}
						/>
						</div>

						<div role="tabpanel" id={`${tabsId}-panel-result`} aria-labelledby={`${tabsId}-tab-result`} hidden={activeSection !== "result"}>
						<SessionResultSection
							value={String(sessionData.result_text || "")}
							onChange={(value) => view.updateData("result_text", value)}
						/>
						</div>
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
				{moveTarget && <EntityMoveDialog campaignSlug={view.campaignSlug} currentSession={session.fileName} entityName={String(moveTarget.entity.name || [moveTarget.entity.firstName, moveTarget.entity.lastName].filter(Boolean).join(" ") || lang.t("Untitled"))} onCancel={() => setMoveTarget(null)} onMove={(destination) => view.transferSessionEntity(moveTarget.type, moveTarget.entity.id, destination)} />}
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
