import { useContext, useEffect, useMemo, useRef, useState } from "react";

import Icon from "./common/Icon.jsx";
import Button from "./form/Button";
import EditableField from "./form/EditableField";
import Panel from "./common/Panel.jsx";
import DraggableList from "./common/DraggableList.jsx";
import Modal from "./common/Modal.jsx";
import NoteCard from "./common/NoteCard.jsx";
import AiContextIgnoreButton from "./common/AiContextIgnoreButton.jsx";
import { getAiIgnoredNoteListProps } from "./common/aiIgnoredNoteListProps.jsx";
import BulkCollapseButton from "./common/BulkCollapseButton.jsx";
import CollapseToggleButton from "./common/CollapseToggleButton.jsx";
import TodoSection from "./session/TodoSection";
import TodoItem from "./session/TodoItem";
import SceneCardHeader from "./session/SceneCardHeader";
import SceneCardMedia from "./session/SceneCardMedia";
import SceneCardFields from "./session/SceneCardFields";
import Tooltip from "./common/Tooltip.jsx";
import GlobalSearchModal from "./campaign/GlobalSearchModal.jsx";
import CharacterCard from "./CharacterCard.jsx";
import LocationCard from "./LocationCard.jsx";
import "../assets/components/SessionView.css";
import useSessionView from "../hooks/useSessionView";
import SessionViewModel from "../models/SessionViewModel.js";
import { lang } from "../services/localization";
import { getNotesForRender, sanitizeNotesForSave } from "../utils/noteUtils";
import { navigateTo, useAppSelector } from "../store/appStore";
import { shouldOpenInNewTabFromEvent } from "../utils/navigation.js";
import { makeDomId, scrollToHashTarget } from "../utils/domNavigation";
import CreateCharacterButton from "./CreateCharacterButton.jsx";
import CreateLocationButton from "./CreateLocationButton.jsx";
import { renderMentionText } from "../renderers/contentRenderer.jsx";
import { EntityLinkResolverContext } from "./common/EntityLinkIdentity.js";
import { findEntityByName } from "../services/entities.js";
import classNames from "../utils/classNames";

function SessionView() {
	const sessionId = useAppSelector(
		(state) => state.navigation.activeSessionFileName,
	);
	const view = useSessionView();
	const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
	const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
	const headerActionsRef = useRef(null);
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
	const sessionScopedEntityLinks = useMemo(() => {
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
		const findCurrentSessionEntity = (modalState) => {
			const items =
				modalState.type === "locations" ? sessionLocations : sessionNpcs;
			return (
				items.find(
					(entity) => String(entity.id) === String(modalState.entity?.id),
				) || modalState.entity
			);
		};

		return {
			resolveEntityByName(name) {
				return (
					findEntityByName(scopedEntities, name) ||
					parentEntityLinks?.resolveEntityByName?.(name) ||
					null
				);
			},
			renderModalContent(modalState, onClose) {
				if (modalState.scope !== "session") {
					return parentEntityLinks?.renderModalContent?.(modalState, onClose);
				}

				const entity = findCurrentSessionEntity(modalState);
				if (modalState.type === "locations") {
					return (
						<LocationCard
							key={entity?.id || "session-scoped-location-modal"}
							location={{ ...entity, collapsed: false }}
							onChange={handleSessionLocationChange}
							onDelete={(id) => {
								handleSessionLocationDelete(id);
								onClose?.();
							}}
							onToggleCollapse={null}
							campaignSlug={scopedCampaignSlug}
							enableHistory={false}
							viewMode="modal"
						/>
					);
				}

				return (
					<CharacterCard
						key={entity?.id || "session-scoped-npc-modal"}
						character={{ ...entity, collapsed: false }}
						onChange={handleSessionNpcChange}
						onDelete={(id) => {
							handleSessionNpcDelete(id);
							onClose?.();
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

	const viewModel = useMemo(
		() =>
			new SessionViewModel({
				...(session || { data: {} }),
				isSaving: view.isSaving,
			}),
		[session, view.isSaving],
	);
	const hasSessionNotesData = (viewModel.notes || []).some(
		(note) =>
			String(note?.title || "").trim().length > 0 ||
			String(note?.text || "").trim().length > 0,
	);
	const sessionNotesForRender = getNotesForRender(viewModel.notes || [], {
		simplifiedNotes: simplifiedNotesEnabled,
	});
	const scenes = useMemo(() => viewModel.scenes || [], [viewModel]);
	const hasSessionNpcsData = view.sessionNpcs.length > 0;
	const hasSessionLocationsData = view.sessionLocations.length > 0;
	const isSessionNotesCollapsed = hasSessionNotesData
		? !!session.data.isNotesCollapsed
		: false;
	const encounterSceneNumbers = new Map();
	scenes.forEach((scene, index) => {
		if (scene?.encounterId == null) return;
		const key = String(scene.encounterId);
		if (!encounterSceneNumbers.has(key)) {
			encounterSceneNumbers.set(key, index + 1);
		}
	});
	const sessionEncounters = (viewModel.encounters || []).map((encounter) => ({
		id: encounter.id,
		name: encounter.name || lang.t("Untitled"),
		sceneNumber: encounterSceneNumbers.get(String(encounter.id)) || null,
	}));
	const { handleToggleSectionCollapse } = view;

	useEffect(() => {
		const hash = decodeURIComponent(window.location.hash || "");
		if (hash.includes("session-note") && isSessionNotesCollapsed) {
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

		const handlePointerDown = (event) => {
			if (headerActionsRef.current?.contains(event.target)) return;
			setIsHeaderActionsOpen(false);
		};

		document.addEventListener("pointerdown", handlePointerDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
		};
	}, [isHeaderActionsOpen]);

	if (!session) return null;

	const openEncounterFromQuickAccess = (encounterId, event) => {
		navigateTo(
			view.campaignSlug,
			sessionId,
			false,
			encounterId,
			shouldOpenInNewTabFromEvent(event),
		);
	};

	const getScopeImportTitle = () => {
		if (view.scopeImportModal?.type === "locations") {
			return lang.t("Choose location/faction to move into this session");
		}
		return lang.t("Choose NPC to move into this session");
	};

	const getScopeImportEmptyText = () => {
		if (view.scopeImportModal?.type === "locations") {
			return lang.t("No campaign locations/factions available.");
		}
		return lang.t("No campaign NPCs available.");
	};

	const getScopeEntityName = (type, entity) => {
		if (type === "locations") {
			return String(entity?.name || entity?.title || lang.t("Untitled")).trim();
		}
		const fullName =
			`${entity?.firstName || ""} ${entity?.lastName || ""}`.trim();
		return String(
			fullName || entity?.name || entity?.title || lang.t("Untitled"),
		).trim();
	};
	const toggleSessionNoteAiIgnored = (noteId, ignored) => {
		view.updateData(
			"notes",
			(viewModel.notes || []).map((note) =>
				note.id === noteId ? { ...note, _aiIgnored: ignored } : note,
			),
		);
	};
	const toggleSessionEntityAiIgnored = (type, entityId, ignored) => {
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
	const toggleSceneNoteAiIgnored = (sceneId, noteId, ignored) => {
		const scene = (viewModel.scenes || []).find((item) => item.id === sceneId);
		if (!scene) return;
		view.handleSceneNotesReorder(
			sceneId,
			(scene.notes || []).map((note) =>
				note.id === noteId ? { ...note, _aiIgnored: ignored } : note,
			),
		);
	};
	const handleBulkSessionNotesCollapse = (collapsed) => {
		view.updateData(
			"notes",
			(viewModel.notes || []).map((note) => ({ ...note, collapsed })),
			true,
		);
	};

	const handleBulkSessionEntitiesCollapse = (type, items, collapsed) => {
		view.updateData(
			type === "locations" ? "locations" : "npcs",
			items.map((item) => ({ ...item, collapsed })),
			true,
		);
	};

	const handleBulkScenesCollapse = (collapsed) => {
		view.updateData(
			"scenes",
			scenes.map((scene) => ({ ...scene, collapsed })),
			true,
		);
	};

	return (
		<EntityLinkResolverContext.Provider value={sessionScopedEntityLinks}>
			<Panel className="SessionView">
				<div className="Panel__header">
					<div className="SessionView__header">
						<div className="SessionView__titleGroup">
							<div className="SessionView__titleRow">
								<Button
									variant="ghost"
									size={Button.SIZES.SMALL}
									onClick={view.handleBack}
									icon="back"
									className="SessionView__backBtn"
								/>
								<h2 className="editable_title" onClick={view.handleRename}>
									{session.name}
								</h2>
							</div>
							{sessionEncounters.length > 0 && (
								<div className="SessionView__encountersQuickAccess">
									<span className="SessionView__encountersLabel">
										{lang.t("Combat encounters")}:
									</span>
									<div className="SessionView__encountersList">
										{sessionEncounters.map((encounter) => (
											<Button
												key={encounter.id}
												variant="ghost"
												size={Button.SIZES.SMALL}
												onClick={(event) =>
													openEncounterFromQuickAccess(encounter.id, event)
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
					<div
						ref={headerActionsRef}
						className={classNames("SessionView__headerActions", {
							is_open: isHeaderActionsOpen,
						})}
					>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="menu"
							className="SessionView__headerActionsToggle"
							onClick={() => setIsHeaderActionsOpen((value) => !value)}
							title={lang.t("Session actions")}
						/>
						<div className="SessionView__headerActionsMenu">
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="search"
								onClick={() => {
									setIsHeaderActionsOpen(false);
									setIsGlobalSearchOpen(true);
								}}
								title={lang.t("Global search")}
							>
								{lang.t("Search")}
							</Button>
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="undo"
								onClick={() => {
									setIsHeaderActionsOpen(false);
									view.handleUndo();
								}}
								disabled={view.undoStack.length === 0 || view.isSaving}
								title={lang.t("Undo (Ctrl+Z)")}
							/>
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="redo"
								onClick={() => {
									setIsHeaderActionsOpen(false);
									view.handleRedo();
								}}
								disabled={view.redoStack.length === 0 || view.isSaving}
								title={lang.t("Redo (Ctrl+Y)")}
							/>
							<Button
								variant="danger"
								size={Button.SIZES.SMALL}
								icon="trash"
								onClick={() => {
									setIsHeaderActionsOpen(false);
									view.handleDeleteSessionAndBack();
								}}
								title={lang.t("Delete session")}
							/>
						</div>
					</div>
				</div>

				<div className="Panel__body">
					<div className="SessionView__todoList">
						<TodoSection
							title={lang.t("Notes")}
							collapsed={isSessionNotesCollapsed}
							onToggle={
								hasSessionNotesData
									? () => view.handleToggleSectionCollapse("Notes")
									: undefined
							}
							action={
								!isSessionNotesCollapsed && (
									<BulkCollapseButton
										items={viewModel.notes || []}
										onChange={handleBulkSessionNotesCollapse}
									/>
								)
							}
						>
							{!isSessionNotesCollapsed && (
								<DraggableList
									items={sessionNotesForRender}
									className="SessionView__notes"
									onReorder={(notes) =>
										view.updateData("notes", sanitizeNotesForSave(notes))
									}
									keyExtractor={(note) => note.id}
									isItemDraggable={(note) => !note._isVirtual}
									isItemControlActive={(note) => Boolean(note._aiIgnored)}
									renderItemControl={(note) =>
										!note._isVirtual && (
											<AiContextIgnoreButton
												ignored={Boolean(note._aiIgnored)}
												onToggle={(ignored) =>
													toggleSessionNoteAiIgnored(note.id, ignored)
												}
											/>
										)
									}
									renderItem={(note, isDragging, index) => (
										<div id={makeDomId("session", "note", note.id)}>
											<NoteCard
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
							)}
						</TodoSection>
						<TodoSection
							title={lang.t("Session NPCs")}
							action={
								<div className="SessionView__sectionActions">
									<BulkCollapseButton
										items={view.sessionNpcs}
										onChange={(collapsed) =>
											handleBulkSessionEntitiesCollapse(
												"npc",
												view.sessionNpcs,
												collapsed,
											)
										}
									/>
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
								</div>
							}
						>
							{hasSessionNpcsData ? (
								<DraggableList
									items={view.sessionNpcs}
									className="SessionView__characters"
									onReorder={view.handleSessionNpcsReorder}
									keyExtractor={(npc) => npc.id}
									isItemControlActive={(npc) => Boolean(npc._aiIgnored)}
									renderItemControl={(npc) => (
										<AiContextIgnoreButton
											ignored={Boolean(npc._aiIgnored)}
											onToggle={(ignored) =>
												toggleSessionEntityAiIgnored("npc", npc.id, ignored)
											}
										/>
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
							) : (
								<div className="muted SessionView__emptySection">
									{lang.t("No session NPCs yet.")}
								</div>
							)}
						</TodoSection>

						<TodoSection
							title={lang.t("Session locations/factions")}
							action={
								<div className="SessionView__sectionActions">
									<BulkCollapseButton
										items={view.sessionLocations}
										onChange={(collapsed) =>
											handleBulkSessionEntitiesCollapse(
												"locations",
												view.sessionLocations,
												collapsed,
											)
										}
									/>
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
								</div>
							}
						>
							{hasSessionLocationsData ? (
								<DraggableList
									items={view.sessionLocations}
									className="SessionView__locations"
									onReorder={view.handleSessionLocationsReorder}
									keyExtractor={(location) => location.id}
									isItemControlActive={(location) =>
										Boolean(location._aiIgnored)
									}
									renderItemControl={(location) => (
										<AiContextIgnoreButton
											ignored={Boolean(location._aiIgnored)}
											onToggle={(ignored) =>
												toggleSessionEntityAiIgnored(
													"locations",
													location.id,
													ignored,
												)
											}
										/>
									)}
									renderItem={(location) => (
										<div id={makeDomId("session", "location", location.id)}>
											<LocationCard
												location={location}
												onToggleCollapse={
													view.handleSessionLocationToggleCollapse
												}
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
															view.moveSessionEntityToCampaign(
																"locations",
																location.id,
															)
														}
														title={lang.t("Move to campaign")}
													/>
												}
											/>
										</div>
									)}
								/>
							) : (
								<div className="muted SessionView__emptySection">
									{lang.t("No session locations/factions yet.")}
								</div>
							)}
						</TodoSection>
						<TodoSection
							title={lang.t("Scenes")}
							action={
								<div className="SessionView__sectionActions">
									<BulkCollapseButton
										items={scenes}
										onChange={handleBulkScenesCollapse}
									/>
									<Button
										variant="primary"
										size={Button.SIZES.SMALL}
										onClick={view.addScene}
										icon="plus"
										iconSize={16}
										className="SessionView__mobileIconOnly"
									>
										{lang.t("Add")}
									</Button>
								</div>
							}
						>
							{scenes.length > 0 && (
								<DraggableList
									items={scenes}
									onReorder={(newScenes) =>
										view.updateData("scenes", newScenes)
									}
									keyExtractor={(scene) => scene.id}
									renderItem={(scene) => {
										const idx = scenes.findIndex((s) => s.id === scene.id);
										return (
											<div id={makeDomId("session", "scene", scene.id)}>
												<SceneCard
													number={idx + 1}
													scene={scene}
													fields={SessionViewModel.sceneSchema}
													collapsed={scene.collapsed}
													onToggle={() => view.toggleSceneCollapse(scene.id)}
													onRemove={() => view.removeScene(scene.id)}
													onOpenEncounter={(event) =>
														view.handleOpenEncounter(scene, event)
													}
													imageUrl={scene.imageUrl}
													onImageChange={(url) =>
														view.updateScene(scene.id, "imageUrl", url, true)
													}
													campaignSlug={view.campaignSlug}
													hasEncounter={!!scene.encounterId}
													encounterName={lang.t(
														viewModel.findEncounterName(scene),
													)}
													onUpdateField={(field, value) =>
														view.updateScene(scene.id, field, value)
													}
													onToggleNotesCollapse={() =>
														view.handleToggleSceneNotesCollapse(scene.id)
													}
													onSceneNoteTitleChange={(noteId, title) =>
														view.handleSceneNoteTitleChange(
															scene.id,
															noteId,
															title,
														)
													}
													onSceneNoteChange={(noteId, text) =>
														view.handleSceneNoteChange(scene.id, noteId, text)
													}
													onSceneNotesReorder={(notes) =>
														view.handleSceneNotesReorder(scene.id, notes)
													}
													onSceneNoteAiIgnoredChange={(noteId, ignored) =>
														toggleSceneNoteAiIgnored(scene.id, noteId, ignored)
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
									}}
								/>
							)}
						</TodoSection>

						<TodoSection title={lang.t("Session result")}>
							<EditableField
								type="textarea"
								className="field__result"
								enableHistory={false}
								placeholder={lang.t("Summary of what actually happened...")}
								value={session.data.result_text || ""}
								onChange={(e) => view.updateData("result_text", e.target.value)}
							/>
						</TodoSection>
					</div>
				</div>

				{view.isChecklistOpen && (
					<Modal
						title={lang.t("Preparation checklist")}
						onCancel={() => view.setIsChecklistOpen(false)}
						showFooter={false}
					>
						<div className="SessionView__checklistModal">
							<div className="SessionView__progressWrap">
								<div className="ProgressBar__label">
									<span>{lang.t("Preparation progress")}</span>
									<span>{view.progress}%</span>
								</div>
								<div className="ProgressBar">
									<div
										className="ProgressBar__fill"
										style={{ width: `${view.progress}%` }}
									></div>
								</div>
							</div>
							{view.checklistItems.map((item) => (
								<TodoItem
									key={item.id}
									checked={!!session.data[`${item.id}_check`]}
									onChange={(val) =>
										view.updateData(`${item.id}_check`, val, true)
									}
									title={item.label}
									note={item.note}
								/>
							))}
						</div>
					</Modal>
				)}

				{view.scopeImportModal && (
					<Modal
						title={getScopeImportTitle()}
						onCancel={view.closeScopeImportModal}
						showFooter={false}
					>
						<div className="SessionView__scopeImportList">
							{view.scopeImportModal.isLoading && (
								<div className="muted">{lang.t("Loading...")}</div>
							)}
							{!view.scopeImportModal.isLoading &&
								view.scopeImportModal.items.length === 0 && (
									<div className="muted">{getScopeImportEmptyText()}</div>
								)}
							{!view.scopeImportModal.isLoading &&
								view.scopeImportModal.items.map((entity) => {
									const name = getScopeEntityName(
										view.scopeImportModal.type,
										entity,
									);
									return (
										<div
											key={entity.slug || entity.id || name}
											className="SessionView__scopeImportItem"
										>
											<span>{renderMentionText(name)}</span>
											<Button
												variant="primary"
												size={Button.SIZES.SMALL}
												icon="import"
												onClick={() =>
													view.moveCampaignEntityToSession(
														view.scopeImportModal.type,
														entity,
													)
												}
											>
												{lang.t("Move to session")}
											</Button>
										</div>
									);
								})}
						</div>
					</Modal>
				)}

				<Tooltip
					content={lang.t("Preparation checklist")}
					className="SessionView__checklistToggle"
				>
					<button onClick={() => view.setIsChecklistOpen(true)}>
						<Icon name="list" size={28} />
						{view.progress < 100 && (
							<span className="SessionView__checklistBadge" />
						)}
					</button>
				</Tooltip>
				{isGlobalSearchOpen && (
					<GlobalSearchModal onCancel={() => setIsGlobalSearchOpen(false)} />
				)}
			</Panel>
		</EntityLinkResolverContext.Provider>
	);
}

export default SessionView;

function SceneCard(props) {
	const encounterLabel = props.hasEncounter
		? props.encounterName
		: lang.t("New encounter");
	const sceneNotes = props.scene.notes || [];
	const sceneNotesForRender = getNotesForRender(sceneNotes, {
		simplifiedNotes: props.simplifiedNotesEnabled,
	});
	const hasSceneNotesData = sceneNotes.some(
		(note) =>
			String(note?.title || "").trim().length > 0 ||
			String(note?.text || "").trim().length > 0,
	);
	const isSceneNotesCollapsed = hasSceneNotesData
		? !!props.scene.isNotesCollapsed
		: false;
	const sceneNotesActionShouldCollapse = sceneNotesForRender.some(
		(note) => !note._isVirtual && !note.collapsed,
	);
	const handleBulkSceneNotesCollapse = () => {
		props.onSceneNotesReorder(
			sceneNotes.map((note) => ({
				...note,
				collapsed: sceneNotesActionShouldCollapse,
			})),
		);
	};

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
