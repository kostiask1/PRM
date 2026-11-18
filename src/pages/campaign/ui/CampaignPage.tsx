import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Button,
	NoteViewMode,
	Panel,
	SectionTabs,
} from "../../../shared/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import { EntityMoveDialog } from "../../../features/campaign-entity/ui/index.js";
import { EmbeddedImageGallery } from "../../../features/images/index.js";
import { ListCard } from "../../../shared/ui/index.js";
import {
	AiContextIgnoreButton,
	useSimplifiedNotesEnabled,
} from "../../../features/notes/ui/index.js";
import {
	CharacterCard,
	CreateCharacterButton,
	CreateLocationButton,
	LocationCard,
} from "../../../widgets/campaign-entity-card/index.js";
import CampaignHeader from "./components/CampaignHeader.tsx";
import CampaignOverview, { type CampaignSection } from "./components/CampaignOverview.tsx";
import CampaignDescriptionSection from "./components/CampaignDescriptionSection.tsx";
import CampaignEntitySection from "./components/CampaignEntitySection.tsx";
import CampaignNotesSection from "./components/CampaignNotesSection.tsx";
import CampaignSessionsSection from "./components/CampaignSessionsSection.tsx";
import CampaignPartialArchiveOverlay from "./components/CampaignPartialArchiveOverlay.tsx";
import { GlobalSearchModal } from "../../../widgets/campaign-search/index.js";
import "../../../assets/components/CampaignView.css";
import useCampaignView from "../model/useCampaignView.ts";
import { useCampaignCharacterTypeDrop } from "../model/useCampaignCharacterTypeDrop.ts";
import { useCampaignHashNavigation } from "../model/useCampaignHashNavigation.ts";
import { useCampaignNotesControls } from "../model/useCampaignNotesControls.ts";
import { getCampaignEntitySectionControls } from "../model/campaignEntitySectionControls.ts";
import { useCampaignPageRuntime } from "../model/CampaignPageRuntime.tsx";
import { CampaignViewModel } from "../../../entities/campaign/index.js";
import { lang } from "../../../shared/lib/index.js";
import { getNotesForRender } from "../../../shared/lib/index.js";
import { makeDomId } from "../../../shared/lib/index.js";
import { useUrlSection } from "../../../shared/lib/index.js";
import type { DomainId } from "../../../entities/campaign/index.js";
import {
	makeHistoryTargetId,
	matchesHistoryTargetId,
} from "../../../entities/history/index.js";
import type { CampaignPageCampaign, CampaignPageEntity } from "../model/contracts.ts";
import {
	filterCampaignSessions,
	getCampaignHashTarget,
	getCampaignEntityAiIgnoredUpdate,
	getCampaignPageCampaign,
	getCampaignSectionState,
	getNextCampaignSectionFromArrowKey,
	isCampaignEditableTarget,
	type CampaignSessionItem,
} from "../model/campaignPagePresentation.ts";

function CampaignView({ campaign }: { campaign: CampaignPageCampaign }) {
	const tabsId = useId();
	const { navigateToSession } = useCampaignPageRuntime();
	const view = useCampaignView({ campaign });
	const viewModel = new CampaignViewModel(campaign);
	const [sessionSearch, setSessionSearch] = useState("");
	const [activeSection, setActiveSection, revealSection] = useUrlSection<CampaignSection>(
		["overview", "sessions", "characters", "npc", "locations", "notes", "story", "gallery"], "overview",
	);
	const lastRevealedHash = useRef("");
	const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
	const [isPartialArchiveOpen, setIsPartialArchiveOpen] = useState(false);
	const [moveTarget, setMoveTarget] = useState<{ type: "npc" | "locations"; entity: CampaignPageEntity } | null>(null);
	const [requestedEntity, setRequestedEntity] = useState<{ type: "characters" | "npc" | "locations"; id: DomainId } | null>(null);
	const simplifiedNotesEnabled = useSimplifiedNotesEnabled();
	const {
		isNotesCollapsed,
		isCharactersCollapsed,
		isNpcsCollapsed,
		isLocationsCollapsed,
	} = getCampaignSectionState(view);
	const notesForRender = getNotesForRender(view.notes || [], {
		simplifiedNotes: simplifiedNotesEnabled,
	});
	const toggleCampaignEntityAiIgnored = (
		type: "npc" | "locations",
		entityId: DomainId | undefined,
		ignored: boolean,
	) => {
		const update = getCampaignEntityAiIgnoredUpdate(
			type,
			entityId,
			ignored,
			view.npcs,
			view.locations,
		);
		if (update.kind === "none") return;
		const applyUpdate = update.kind === "locations"
			? view.handleLocationChange
			: view.handleNpcChange;
		applyUpdate(update.entityId, update.entity);
	};
	const filteredSessions = useMemo(
		() => filterCampaignSessions(view.sessions, sessionSearch),
		[view.sessions, sessionSearch],
	);
	const allSessions = useMemo(() => filterCampaignSessions(view.sessions, ""), [view.sessions]);

	const canReorderSessions = sessionSearch.trim().length === 0;
	const {
		setIsCharactersCollapsed,
		setIsLocationsCollapsed,
		setIsNotesCollapsed,
		setIsNpcsCollapsed,
	} = view;
	const {
		notesViewMode,
		setNotesViewMode,
		handleNotesViewModeChange,
		toggleCampaignNoteAiIgnored,
	} = useCampaignNotesControls({
		notes: view.notes,
		isNotesCollapsed,
		onNotesReorder: view.handleNotesReorder,
		onFinishTrackedReorder: view.finishTrackedReorder,
		onSetNotesCollapsed: view.setIsNotesCollapsed,
		onTriggerSave: view.triggerSave,
	});
	const characterSectionControls = getCampaignEntitySectionControls({
		type: "characters",
		onPersistReorder: view.persistEntitiesReorder,
	});
	const npcSectionControls = getCampaignEntitySectionControls({
		type: "npc",
		onPersistReorder: view.persistEntitiesReorder,
	});
	const locationSectionControls = getCampaignEntitySectionControls({
		type: "locations",
		onPersistReorder: view.persistEntitiesReorder,
	});
	const revealCampaignHistoryTarget = useCallback((hash: string) => {
		if (hash !== lastRevealedHash.current) {
			lastRevealedHash.current = hash;
			const target = getCampaignHashTarget(hash);
			if (target) revealSection(target);
			else if (hash.includes("campaign-sessions")) revealSection("sessions");
			else if (hash.includes("campaign-description")) revealSection("story");
		}
		const campaignNote = view.notes.find((note) =>
			matchesHistoryTargetId(hash, "campaign", "note", note.id),
		);
		if (campaignNote?.collapsed) view.handleToggleNoteCollapse(campaignNote.id);

		const entityGroups = [
			{
				kind: "character" as const,
				items: view.characters,
				onChange: view.handleCharacterChange,
			},
			{
				kind: "npc" as const,
				items: view.npcs,
				onChange: view.handleNpcChange,
			},
			{
				kind: "location" as const,
				items: view.locations,
				onChange: view.handleLocationChange,
			},
		];
		for (const group of entityGroups) {
			for (const entity of group.items) {
				if (entity.id === undefined) continue;
				const targetNote = (entity.notes || []).find((note) =>
					matchesHistoryTargetId(
						hash,
						"campaign",
						`${group.kind}-note`,
						entity.id,
						note.id,
					),
				);
				const targetsEntity = matchesHistoryTargetId(
					hash,
					"campaign",
					group.kind,
					entity.id,
				);
				if (!targetNote && !targetsEntity) continue;
				const notes = targetNote
					? (entity.notes || []).map((note) =>
						note.id === targetNote.id && note.collapsed
							? { ...note, collapsed: false }
							: note,
					)
					: entity.notes;
				if (
					!entity.collapsed &&
					(!targetNote || (!entity.isNotesCollapsed && !targetNote.collapsed))
				) {
					return;
				}
				group.onChange(entity.id, {
					...entity,
					collapsed: false,
					...(targetNote ? { isNotesCollapsed: false, notes } : {}),
				});
				return;
			}
		}
	}, [
		revealSection,
		view.characters,
		view.handleCharacterChange,
		view.handleLocationChange,
		view.handleNpcChange,
		view.handleToggleNoteCollapse,
		view.locations,
		view.notes,
		view.npcs,
	]);

	useCampaignHashNavigation({
		campaignSlug: campaign.slug,
		isCharactersCollapsed,
		isLocationsCollapsed,
		isNotesCollapsed,
		isNpcsCollapsed,
		notesForRender,
		setIsCharactersCollapsed,
		setIsLocationsCollapsed,
		setIsNotesCollapsed,
		setIsNpcsCollapsed,
		setNotesViewMode,
		onRevealHistoryTarget: revealCampaignHistoryTarget,
	});

	useCampaignCharacterTypeDrop({
		viewDependency: view,
		onCharacterTypeDrop: view.handleCharacterTypeDrop,
	});

	const renderCampaignDescriptionEditor = () => (
		<EditableField
			data-history-field="description"
			type="textarea"
			className="CampaignView__script"
			enableHistory={false}
			placeholder={lang.t(
				"Describe the main plotline, key events, and goals...",
			)}
			value={view.description}
			onChange={view.handleDescriptionChange}
		/>
	);

	const renderSessionCard = (session: CampaignSessionItem) => (
		<ListCard
			key={session.fileName}
			className="CampaignView__sessionCard"
			href={viewModel.buildSessionHref(session.fileName)}
			onClick={() => navigateToSession(campaign.slug, session.fileName)}
			actions={
				<Button
					className="CampaignView__sessionDelete"
					variant="danger"
					icon="trash"
					size={Button.SIZES.SMALL}
					aria-label={`${lang.t("Delete session")}: ${session.name}`}
					title={lang.t("Delete session")}
					onClick={(e) => {
						e.stopPropagation();
						view.handleDeleteSession(session);
					}}
				/>
			}
		>
			<span className="CampaignView__sessionNumber">{String(view.sessions.findIndex((item) => item.fileName === session.fileName) + 1).padStart(2, "0")}</span>
			<span className="CampaignView__sessionIdentity"><span className="ListCard__title">{session.name}</span>
				<span className="ListCard__meta">{lang.t("Session")}</span>
			</span>
		</ListCard>
	);
	const onCloseGlobalSearch = () => setIsGlobalSearchOpen(false);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target instanceof HTMLElement ? event.target : null;
			const isInteractiveOrEditable =
				isCampaignEditableTarget(target) ||
				target?.tagName === "SELECT" ||
				Boolean(target?.closest("[contenteditable='true'], [role='tablist']"));
			const nextSection = getNextCampaignSectionFromArrowKey({
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

	return (
		<Panel
			className="CampaignView"
			data-history-focus-id={makeHistoryTargetId("campaign", "summary")}
		>
			<CampaignHeader
				view={view}
				viewModel={viewModel}
				onCreateSession={view.handleCreateSession}
				onOpenSearch={() => setIsGlobalSearchOpen(true)}
				onOpenPartialArchive={() => setIsPartialArchiveOpen(true)}
			/>
			<div className="Panel__body">
				<div className="CampaignView__navigation">
				<SectionTabs<CampaignSection> idPrefix={tabsId} label={lang.t("Campaign sections")} value={activeSection} onChange={setActiveSection} items={[
					{ id: "overview", label: lang.t("Overview") },
					{ id: "sessions", label: lang.t("Sessions"), count: view.sessions.length },
					{ id: "characters", label: lang.t("Characters"), count: view.characters.length },
					{ id: "npc", label: lang.t("NPC"), count: view.npcs.length },
					{ id: "locations", label: lang.t("Locations/Factions"), count: view.locations.length },
					{ id: "notes", label: lang.t("Notes") },
					{ id: "story", label: lang.t("Campaign story") },
					{ id: "gallery", label: lang.t("Gallery") },
				]} />
				<div className="CampaignView__navigationActions">
					{activeSection === "overview" && (
						<Button size={Button.SIZES.SMALL} icon="notes-graph" onClick={() => { handleNotesViewModeChange("graph"); setActiveSection("notes"); }}>
							{lang.t("Notes graph")}
						</Button>
					)}
					{activeSection === "sessions" && (
						<Button variant="create" size={Button.SIZES.SMALL} icon="plus" onClick={view.handleCreateSession}>
							{lang.t("New session")}
						</Button>
					)}
					{activeSection === "characters" && (
						<CreateCharacterButton
							onCreated={(entity) => { if (entity.id != null) setRequestedEntity({ type: "characters", id: entity.id }); }}
							campaignSlug={campaign.slug}
							entityType="characters"
						/>
					)}
					{activeSection === "npc" && (
						<CreateCharacterButton
							onCreated={(entity) => { if (entity.id != null) setRequestedEntity({ type: "npc", id: entity.id }); }}
							campaignSlug={campaign.slug}
							entityType="npc"
						/>
					)}
					{activeSection === "locations" && (
						<CreateLocationButton
							campaignSlug={campaign.slug}
							onCreated={(entity) => { if (entity.id != null) setRequestedEntity({ type: "locations", id: entity.id }); }}
						/>
					)}
					{activeSection === "notes" && (
						<NoteViewMode
							className="CampaignNotesSection__viewToggle"
							value={notesViewMode}
							onChange={handleNotesViewModeChange}
							options={[
								{
									value: "list",
									label: lang.t("List"),
									title: lang.t("List view"),
									icon: "list",
								},
								{
									value: "graph",
									label: lang.t("Graph"),
									title: lang.t("Graph view"),
									icon: "notes-graph",
								},
							]}
						/>
					)}
				</div>
				</div>
				<div role="tabpanel" id={`${tabsId}-panel-overview`} aria-labelledby={`${tabsId}-tab-overview`} hidden={activeSection !== "overview"}>
					<CampaignOverview sessions={allSessions} characters={view.characters} notes={view.notes}
						description={view.description} onSelectSection={setActiveSection} onCreateSession={view.handleCreateSession}
						onOpenCharacter={(id) => { setRequestedEntity({ type: "characters", id }); setActiveSection("characters"); }}
						onOpenSession={(session) => navigateToSession(campaign.slug, session.fileName)} renderSessionCard={renderSessionCard} />
				</div>
				<div className="CampaignView__layout">
					<div role="tabpanel" id={`${tabsId}-panel-sessions`} aria-labelledby={`${tabsId}-tab-sessions`} hidden={activeSection !== "sessions"}>
					<CampaignSessionsSection
						canReorderSessions={canReorderSessions}
						filteredSessions={filteredSessions}
						onCreateSession={view.handleCreateSession}
						onReorder={view.setSessions}
						onReorderDrop={view.handleSessionReorderDrop}
						onSessionSearchChange={setSessionSearch}
						renderSessionCard={renderSessionCard}
						sessionSearch={sessionSearch}
					/>
					</div>

					<div className="CampaignView__contentPanel">
						<div role="tabpanel" id={`${tabsId}-panel-gallery`} aria-labelledby={`${tabsId}-tab-gallery`} hidden={activeSection !== "gallery"}>
							{activeSection === "gallery" && <EmbeddedImageGallery campaignSlug={campaign.slug} />}
						</div>
						<div role="tabpanel" id={`${tabsId}-panel-story`} aria-labelledby={`${tabsId}-tab-story`} hidden={activeSection !== "story"}>
						<CampaignDescriptionSection
							renderEditor={renderCampaignDescriptionEditor}
						/>
						</div>

						<div role="tabpanel" id={`${tabsId}-panel-notes`} aria-labelledby={`${tabsId}-tab-notes`} hidden={activeSection !== "notes"}>
						<CampaignNotesSection
							campaign={campaign}
							view={view}
							notes={notesForRender}
							viewMode={notesViewMode}
							onViewModeChange={handleNotesViewModeChange}
							onToggleIgnored={toggleCampaignNoteAiIgnored}
						/>
						</div>

						<div role="tabpanel" id={`${tabsId}-panel-characters`} aria-labelledby={`${tabsId}-tab-characters`} hidden={activeSection !== "characters"}>
						<CampaignEntitySection
							historyFocusId={makeHistoryTargetId(
								"campaign",
								"character-section",
							)}
							title={lang.t("Characters")}
							items={view.characters}
							selectionRequest={requestedEntity?.type === "characters" ? requestedEntity : null}
							listVariant="person"
							dropType="characters"
							onReorder={view.handleCharactersReorder}
							onReorderDrop={characterSectionControls.onReorderDrop}
							dragData={(character) => ({
								kind: "campaign-character",
								sourceType: "characters",
								id: character.id,
							})}
							renderItem={(character) => (
								<div
									id={makeDomId("campaign", "character", character.id)}
									data-history-focus-id={makeHistoryTargetId(
										"campaign",
										"character",
										character.id,
									)}
								>
									<CharacterCard
										character={character}
										onChange={(id, updated) => {
											if (id !== undefined) {
												view.handleCharacterChange(id, updated);
											}
										}}
										onNameBlur={(id, updated, oldName, newName) =>
											id === undefined
												? false
												: view.handleCharacterNameBlur(id, updated, oldName, newName)
										}
										onDelete={(id) => {
											if (id !== undefined) void view.handleDeleteCharacter(id);
										}}
										onReorderDrop={view.finishTrackedReorder}
										campaignSlug={campaign.slug}
										enableHistory={false}
										type="characters"
									/>
								</div>
							)}
						/>

						</div>
						<div role="tabpanel" id={`${tabsId}-panel-npc`} aria-labelledby={`${tabsId}-tab-npc`} hidden={activeSection !== "npc"}>
						<CampaignEntitySection
							historyFocusId={makeHistoryTargetId(
								"campaign",
								"npc-section",
							)}
							title={lang.t("NPC")}
							items={view.npcs}
							selectionRequest={requestedEntity?.type === "npc" ? requestedEntity : null}
							listVariant="person"
							dropType="npc"
							onReorder={view.handleNpcsReorder}
							onReorderDrop={npcSectionControls.onReorderDrop}
							dragData={(npc) => ({
								kind: "campaign-character",
								sourceType: "npc",
								id: npc.id,
							})}
							isItemControlActive={(npc) => Boolean(npc._aiIgnored)}
							renderItemControl={(npc) => (
								<AiContextIgnoreButton
									ignored={Boolean(npc._aiIgnored)}
									onToggle={(ignored) =>
										toggleCampaignEntityAiIgnored("npc", npc.id, ignored)
									}
								/>
							)}
							renderItem={(npc) => (
								<div
									id={makeDomId("campaign", "npc", npc.id)}
									data-history-focus-id={makeHistoryTargetId(
										"campaign",
										"npc",
										npc.id,
									)}
								>
									<CharacterCard
										character={npc}
										headerActions={<Button variant="ghost" icon="export" onClick={() => setMoveTarget({ type: "npc", entity: npc })}>{lang.t("Move")}</Button>}
										onChange={(id, updated) => {
											if (id !== undefined) {
												view.handleNpcChange(id, updated);
											}
										}}
										onNameBlur={(id, updated, oldName, newName) =>
											id === undefined
												? false
												: view.handleNpcNameBlur(id, updated, oldName, newName)
										}
										onDelete={(id) => {
											if (id !== undefined) void view.handleNpcDelete(id);
										}}
										onReorderDrop={view.finishTrackedReorder}
										campaignSlug={campaign.slug}
										enableHistory={false}
										type="npc"
									/>
								</div>
							)}
						/>

						</div>
						<div role="tabpanel" id={`${tabsId}-panel-locations`} aria-labelledby={`${tabsId}-tab-locations`} hidden={activeSection !== "locations"}>
						<CampaignEntitySection
							historyFocusId={makeHistoryTargetId(
								"campaign",
								"location-section",
							)}
							title={lang.t("Locations/Factions")}
							items={view.locations}
							selectionRequest={requestedEntity?.type === "locations" ? requestedEntity : null}
							listVariant="location"
							onReorder={view.handleLocationsReorder}
							onReorderDrop={locationSectionControls.onReorderDrop}
							isItemControlActive={(location) =>
								Boolean(location._aiIgnored)
							}
							renderItemControl={(location) => (
								<AiContextIgnoreButton
									ignored={Boolean(location._aiIgnored)}
									onToggle={(ignored) =>
										toggleCampaignEntityAiIgnored(
											"locations",
											location.id,
											ignored,
										)
									}
								/>
							)}
							renderItem={(location) => (
								<div
									id={makeDomId("campaign", "location", location.id)}
									data-history-focus-id={makeHistoryTargetId(
										"campaign",
										"location",
										location.id,
									)}
								>
									<LocationCard
										location={location}
										headerActions={<Button variant="ghost" icon="export" onClick={() => setMoveTarget({ type: "locations", entity: location })}>{lang.t("Move")}</Button>}
										onChange={(id, updated) => {
											if (id !== undefined) {
												view.handleLocationChange(id, updated);
											}
										}}
										onNameBlur={(id, updated, oldName, newName) =>
											id === undefined
												? false
												: view.handleLocationNameBlur(id, updated, oldName, newName)
										}
										onDelete={(id) => {
											if (id !== undefined) void view.handleLocationDelete(id);
										}}
										onReorderDrop={view.finishTrackedReorder}
										campaignSlug={campaign.slug}
										enableHistory={false}
									/>
								</div>
							)}
						/>
					</div>
				</div>
				</div>
			</div>
			{isGlobalSearchOpen && (
				<GlobalSearchModal onCancel={onCloseGlobalSearch} />
			)}
			{moveTarget && <EntityMoveDialog campaignSlug={campaign.slug} entityName={String(moveTarget.entity.name || [moveTarget.entity.firstName, moveTarget.entity.lastName].filter(Boolean).join(" ") || lang.t("Untitled"))} onCancel={() => setMoveTarget(null)} onMove={async (destination) => {
				if (typeof moveTarget.entity.slug !== "string" || !moveTarget.entity.slug) throw new Error("Entity slug is required.");
				await view.transferCampaignEntity(moveTarget.type, moveTarget.entity.slug, destination);
			}} />}
			<CampaignPartialArchiveOverlay
				open={isPartialArchiveOpen}
				onClose={() => setIsPartialArchiveOpen(false)}
				onExport={(sections) => view.handleExportPartial(sections)}
				onImport={(file, sections) => view.handleImportPartial(file, sections)}
			/>
		</Panel>
	);
}

export default function CampaignPage() {
	const { activeCampaign } = useCampaignPageRuntime();
	const campaign = getCampaignPageCampaign(
		activeCampaign,
	);
	return campaign ? <CampaignView campaign={campaign} /> : null;
}
