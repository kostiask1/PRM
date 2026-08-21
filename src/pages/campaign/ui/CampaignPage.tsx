import {
	useMemo,
	useState,
} from "react";
import {
	Button,
	Panel,
} from "../../../shared/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
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
import type { DomainId } from "../../../entities/campaign/index.js";
import type { CampaignPageCampaign } from "../model/contracts.ts";
import {
	filterCampaignSessions,
	getCampaignEntityAiIgnoredUpdate,
	getCampaignPageCampaign,
	getCampaignSectionState,
	type CampaignSessionItem,
} from "../model/campaignPagePresentation.ts";

type CampaignViewController = ReturnType<typeof useCampaignView>;

function CampaignView({ campaign }: { campaign: CampaignPageCampaign }) {
	const { navigateToSession } = useCampaignPageRuntime();
	const view = useCampaignView({ campaign });
	const viewModel = new CampaignViewModel(campaign);
	const [sessionSearch, setSessionSearch] = useState("");
	const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
	const [isPartialArchiveOpen, setIsPartialArchiveOpen] = useState(false);
	const simplifiedNotesEnabled = useSimplifiedNotesEnabled();
	const {
		hasDescriptionData,
		hasNotesData,
		hasCharactersData,
		hasNpcsData,
		hasLocationsData,
		isDescriptionCollapsed,
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
		handleBulkNotesCollapse,
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
		hasData: hasCharactersData,
		isCollapsed: isCharactersCollapsed,
		onSetCollapsed: view.setIsCharactersCollapsed,
		onTriggerSave: view.triggerSave,
		onReorder: view.handleCharactersReorder,
		onPersistReorder: view.persistEntitiesReorder,
	});
	const npcSectionControls = getCampaignEntitySectionControls({
		type: "npc",
		hasData: hasNpcsData,
		isCollapsed: isNpcsCollapsed,
		onSetCollapsed: view.setIsNpcsCollapsed,
		onTriggerSave: view.triggerSave,
		onReorder: view.handleNpcsReorder,
		onPersistReorder: view.persistEntitiesReorder,
	});
	const locationSectionControls = getCampaignEntitySectionControls({
		type: "locations",
		hasData: hasLocationsData,
		isCollapsed: isLocationsCollapsed,
		onSetCollapsed: view.setIsLocationsCollapsed,
		onTriggerSave: view.triggerSave,
		onReorder: view.handleLocationsReorder,
		onPersistReorder: view.persistEntitiesReorder,
	});

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
	});

	useCampaignCharacterTypeDrop({
		viewDependency: view,
		onCharacterTypeDrop: view.handleCharacterTypeDrop,
	});

	const toggleCampaignDescription = () => {
		if (!hasDescriptionData) return;
		const next = !isDescriptionCollapsed;
		view.setIsDescriptionCollapsed(next);
		view.triggerSave({ isDescriptionCollapsed: next });
	};
	const renderCampaignDescriptionEditor = () => (
		<EditableField
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
					onClick={(e) => {
						e.stopPropagation();
						view.handleDeleteSession(session);
					}}
				/>
			}
		>
			<div className="ListCard__title">{session.name}</div>
		</ListCard>
	);
	const onCloseGlobalSearch = () => setIsGlobalSearchOpen(false);

	return (
		<Panel className="CampaignView">
			<CampaignHeader
				view={view}
				viewModel={viewModel}
				onOpenSearch={() => setIsGlobalSearchOpen(true)}
				onOpenPartialArchive={() => setIsPartialArchiveOpen(true)}
			/>
			<div className="Panel__body">
				<div className="CampaignView__layout">
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

					<div className="CampaignView__contentPanel">
						<CampaignDescriptionSection
							hasData={hasDescriptionData}
							isCollapsed={isDescriptionCollapsed}
							onToggle={toggleCampaignDescription}
							renderEditor={renderCampaignDescriptionEditor}
						/>

						<CampaignNotesSection
							campaign={campaign}
							view={view}
							notes={notesForRender}
							hasData={hasNotesData}
							isCollapsed={isNotesCollapsed}
							viewMode={notesViewMode}
							onViewModeChange={handleNotesViewModeChange}
							onBulkCollapse={handleBulkNotesCollapse}
							onToggleIgnored={toggleCampaignNoteAiIgnored}
						/>

						<CampaignEntitySection
							title={lang.t("Characters")}
							items={view.characters}
							hasData={hasCharactersData}
							isCollapsed={isCharactersCollapsed}
							listClassName="CampaignView__characters"
							dropType="characters"
							actions={
								<CreateCharacterButton
									campaignSlug={campaign.slug}
									entityType="characters"
								/>
							}
							onToggle={characterSectionControls.onToggle}
							onBulkCollapse={characterSectionControls.onBulkCollapse}
							onReorder={view.handleCharactersReorder}
							onReorderDrop={characterSectionControls.onReorderDrop}
							dragData={(character) => ({
								kind: "campaign-character",
								sourceType: "characters",
								id: character.id,
							})}
							renderItem={(character) => (
								<div id={makeDomId("campaign", "character", character.id)}>
									<CharacterCard
										character={character}
										onToggleCollapse={(id) => {
											if (id !== undefined) view.handleToggleCharacterCollapse(id);
										}}
										onChange={(id, updated, options) => {
											if (id !== undefined) view.handleCharacterChange(id, updated, options);
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

						<CampaignEntitySection
							title={lang.t("NPC")}
							items={view.npcs}
							hasData={hasNpcsData}
							isCollapsed={isNpcsCollapsed}
							listClassName="CampaignView__characters"
							dropType="npc"
							actions={
								<CreateCharacterButton
									campaignSlug={campaign.slug}
									entityType="npc"
								/>
							}
							onToggle={npcSectionControls.onToggle}
							onBulkCollapse={npcSectionControls.onBulkCollapse}
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
								<div id={makeDomId("campaign", "npc", npc.id)}>
									<CharacterCard
										character={npc}
										onToggleCollapse={(id) => {
											if (id !== undefined) view.handleToggleNpcCollapse(id);
										}}
										onChange={(id, updated, options) => {
											if (id !== undefined) view.handleNpcChange(id, updated, options);
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

						<CampaignEntitySection
							title={lang.t("Locations/Factions")}
							items={view.locations}
							hasData={hasLocationsData}
							isCollapsed={isLocationsCollapsed}
							listClassName="CampaignView__locations"
							actions={<CreateLocationButton campaignSlug={campaign.slug} />}
							onToggle={locationSectionControls.onToggle}
							onBulkCollapse={locationSectionControls.onBulkCollapse}
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
								<div id={makeDomId("campaign", "location", location.id)}>
									<LocationCard
										location={location}
										onToggleCollapse={(id) => {
											if (id !== undefined) view.handleToggleLocationCollapse(id);
										}}
										onChange={(id, updated, options) => {
											if (id !== undefined) view.handleLocationChange(id, updated, options);
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
			{isGlobalSearchOpen && (
				<GlobalSearchModal onCancel={onCloseGlobalSearch} />
			)}
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
