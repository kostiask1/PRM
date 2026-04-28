import { useMemo, useState } from "react";
import AiAssistantPanel from "./AiAssistantPanel";
import Button from "./form/Button";
import EditableField from "./form/EditableField";
import ListCard from "./common/ListCard.jsx";
import Panel from "./common/Panel.jsx";
import StatusBadge from "./common/StatusBadge.jsx";
import DraggableList from "./common/DraggableList.jsx";
import NoteCard from "./common/NoteCard.jsx";
import CharacterCard from "./CharacterCard";
import LocationCard from "./LocationCard";
import CollapseToggleButton from "./common/CollapseToggleButton.jsx";
import Tooltip from "./common/Tooltip.jsx";
import CreateCharacterButton from "./CreateCharacterButton";
import CreateLocationButton from "./CreateLocationButton";
import "../assets/components/CampaignView.css";
import useCampaignView from "../hooks/useCampaignView";
import CampaignViewModel from "../models/CampaignViewModel.js";
import { navigateTo } from "../store/appStore";
import { lang } from "../services/localization";
import { getNotesForRender, sanitizeNotesForSave } from "../utils/noteUtils";

function CampaignView(props) {
	const campaign = props.campaign;
	const view = useCampaignView(props);
	const viewModel = new CampaignViewModel(campaign);
	const [sessionSearch, setSessionSearch] = useState("");
	const [sessionStatusFilter, setSessionStatusFilter] = useState("all");
	const hasDescriptionData = String(view.description || "").trim().length > 0;
	const hasNotesData = (view.notes || []).some(
		(note) =>
			String(note?.title || "").trim().length > 0 ||
			String(note?.text || "").trim().length > 0,
	);
	const notesForRender = getNotesForRender(view.notes || []);
	const hasCharactersData = (view.characters || []).length > 0;
	const hasNpcsData = (view.npcs || []).length > 0;
	const hasLocationsData = (view.locations || []).length > 0;
	const isDescriptionCollapsed = hasDescriptionData
		? view.isDescriptionCollapsed
		: false;
	const isNotesCollapsed = hasNotesData ? view.isNotesCollapsed : false;
	const isCharactersCollapsed = hasCharactersData
		? view.isCharactersCollapsed
		: false;
	const isNpcsCollapsed = hasNpcsData ? view.isNpcsCollapsed : false;
	const isLocationsCollapsed = hasLocationsData
		? view.isLocationsCollapsed
		: false;

	const filteredSessions = useMemo(() => {
		const query = sessionSearch.trim().toLowerCase();
		return view.sessions.filter((session) => {
			const matchesQuery =
				!query ||
				String(session.name || "")
					.toLowerCase()
					.includes(query);
			const matchesStatus =
				sessionStatusFilter === "all"
					? true
					: sessionStatusFilter === "completed"
						? !!session.completed
						: !session.completed;
			return matchesQuery && matchesStatus;
		});
	}, [view.sessions, sessionSearch, sessionStatusFilter]);

	const canReorderSessions =
		sessionStatusFilter === "all" && sessionSearch.trim().length === 0;

	const renderSessionCard = (session, isDragging = false) => (
		<ListCard
			key={session.fileName}
			href={viewModel.buildSessionHref(session.fileName)}
			dragging={isDragging}
			onClick={() => navigateTo(campaign.slug, session.fileName)}
			actions={
				<>
					<StatusBadge
						completed={session.completed}
						onClick={() => view.handleToggleSessionStatus(session)}
						type="session"
					/>
					<Button
						variant="danger"
						icon="trash"
						size={Button.SIZES.SMALL}
						iconSize={16}
						onClick={(e) => {
							e.stopPropagation();
							view.handleDeleteSession(session);
						}}
						title={lang.t("Delete session")}
					/>
				</>
			}
		>
			<div className="ListCard__title">{session.name}</div>
			<div className="ListCard__meta">
				{lang.t("Updated")}:{" "}
				{viewModel.formatSessionUpdatedAt(session.updatedAt)}
			</div>
		</ListCard>
	);

	return (
		<Panel className="CampaignView">
			<div className="Panel__header">
				<div className="CampaignView__header">
					<Tooltip content={lang.t("Click to rename")}>
						<h2 className="editable-title" onClick={view.handleRename}>
							{viewModel.name}
						</h2>
					</Tooltip>
					<p className="muted">
						{lang.t("Created")}: {viewModel.createdAtLabel}
					</p>
				</div>
				<div className="CampaignView__headerActions">
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="undo"
						onClick={view.handleUndo}
						disabled={view.undoStack.length === 0}
						title={lang.t("Undo (Ctrl+Z)")}
					/>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="redo"
						onClick={view.handleRedo}
						disabled={view.redoStack.length === 0}
						title={lang.t("Redo (Ctrl+Y)")}
					/>
					<Button onClick={view.handleExport} icon="export">
						{lang.t("Export")}
					</Button>
					<Button
						variant="danger"
						icon="trash"
						onClick={view.handleDeleteCampaign}
						title={lang.t("Delete campaign")}
					/>
				</div>
			</div>
			<div className="Panel__body">
				<div className="CampaignView__layout">
					<aside className="CampaignView__sessionsPane" id="campaign-sessions">
						<div className="CampaignView__sessionsPaneHeader">
							<h3>{lang.t("Sessions")}</h3>
							<Button
								variant="create"
								onClick={view.handleCreateSession}
								icon="plus"
								size={Button.SIZES.SMALL}
								strokeWidth={2.5}
							>
								{lang.t("New session")}
							</Button>
						</div>
						<div className="CampaignView__sessionsPaneControls">
							<input
								className="CampaignView__sessionSearch"
								placeholder={lang.t("Search sessions...")}
								value={sessionSearch}
								onChange={(e) => setSessionSearch(e.target.value)}
							/>
							<div className="CampaignView__sessionFilterRow">
								<Button
									variant={sessionStatusFilter === "all" ? "primary" : "ghost"}
									size={Button.SIZES.SMALL}
									onClick={() => setSessionStatusFilter("all")}
								>
									{lang.t("All")}
								</Button>
								<Button
									variant={
										sessionStatusFilter === "active" ? "primary" : "ghost"
									}
									size={Button.SIZES.SMALL}
									onClick={() => setSessionStatusFilter("active")}
								>
									{lang.t("Active")}
								</Button>
								<Button
									variant={
										sessionStatusFilter === "completed" ? "primary" : "ghost"
									}
									size={Button.SIZES.SMALL}
									onClick={() => setSessionStatusFilter("completed")}
								>
									{lang.t("Completed")}
								</Button>
							</div>
						</div>
						<div className="CampaignView__sessionsPaneList">
							{canReorderSessions ? (
								<DraggableList
									items={filteredSessions}
									onReorder={view.setSessions}
									onDrop={view.handleSessionReorderDrop}
									keyExtractor={(session) => session.fileName}
									renderItem={(session, isDragging) =>
										renderSessionCard(session, isDragging)
									}
								/>
							) : (
								<div className="CampaignView__sessions">
									{filteredSessions.map((session) =>
										renderSessionCard(session),
									)}
								</div>
							)}
							{filteredSessions.length === 0 && (
								<div className="muted CampaignView__emptySessions">
									{lang.t("No sessions found.")}
								</div>
							)}
						</div>
					</aside>

					<div className="CampaignView__contentPanel">
						<div className="CampaignView__section">
							<div className="section-row">
								<div
									className="section-title-group"
									onClick={() => {
										if (!hasDescriptionData) return;
										const next = !isDescriptionCollapsed;
										view.setIsDescriptionCollapsed(next);
										view.triggerSave({ isDescriptionCollapsed: next });
									}}
								>
									{hasDescriptionData && (
										<CollapseToggleButton
											size={Button.SIZES.MEDIUM}
											collapsed={isDescriptionCollapsed}
											onClick={() => {
												const next = !isDescriptionCollapsed;
												view.setIsDescriptionCollapsed(next);
												view.triggerSave({ isDescriptionCollapsed: next });
											}}
										/>
									)}
									<h3>{lang.t("Campaign story")}</h3>
								</div>
							</div>
							{!isDescriptionCollapsed && (
								<EditableField
									type="textarea"
									className="CampaignView__script"
									placeholder={lang.t(
										"Describe the main plotline, key events, and goals...",
									)}
									value={view.description}
									onChange={view.handleDescriptionChange}
								/>
							)}
						</div>

						<div className="CampaignView__section">
							<div className="section-row">
								<div
									className="section-title-group"
									onClick={() => {
										if (!hasNotesData) return;
										const next = !isNotesCollapsed;
										view.setIsNotesCollapsed(next);
										view.triggerSave({ isNotesCollapsed: next });
									}}
								>
									{hasNotesData && (
										<CollapseToggleButton
											size={Button.SIZES.MEDIUM}
											collapsed={isNotesCollapsed}
											onClick={() => {
												const next = !isNotesCollapsed;
												view.setIsNotesCollapsed(next);
												view.triggerSave({ isNotesCollapsed: next });
											}}
										/>
									)}
									<h3>{lang.t("Notes")}</h3>
								</div>
							</div>
							{!isNotesCollapsed && (
								<DraggableList
									items={notesForRender}
									className="CampaignView__notes"
									onReorder={(newNotes) =>
										view.setNotes(sanitizeNotesForSave(newNotes))
									}
									onDrop={() =>
										view.triggerSave({
											notes: sanitizeNotesForSave(view.notes),
										})
									}
									keyExtractor={(note) => note.id}
									renderItem={(note, isDragging, index) => (
										<NoteCard
											note={note}
											isLast={index === notesForRender.length - 1}
											isDragging={isDragging}
											campaignSlug={campaign.slug}
											onToggleCollapse={view.handleToggleNoteCollapse}
											onTitleChange={view.handleNoteTitleChange}
											onTextChange={view.handleNoteChange}
											onDelete={view.handleDeleteNote}
										/>
									)}
								/>
							)}
						</div>

						<div className="CampaignView__section">
							<div className="section-row">
								<div
									className="section-title-group"
									onClick={() => {
										if (!hasCharactersData) return;
										const next = !isCharactersCollapsed;
										view.setIsCharactersCollapsed(next);
										view.triggerSave({ isCharactersCollapsed: next });
									}}
								>
									{hasCharactersData && (
										<CollapseToggleButton
											size={Button.SIZES.MEDIUM}
											collapsed={isCharactersCollapsed}
											onClick={() => {
												const next = !isCharactersCollapsed;
												view.setIsCharactersCollapsed(next);
												view.triggerSave({ isCharactersCollapsed: next });
											}}
										/>
									)}
									<h3>{lang.t("Characters")}</h3>
								</div>
								{!isCharactersCollapsed && (
									<CreateCharacterButton
										campaignSlug={campaign.slug}
										entityType="characters"
									/>
								)}
							</div>
							{!isCharactersCollapsed && (
								<DraggableList
									items={view.characters}
									className="CampaignView__characters"
									onReorder={view.setCharacters}
									onDrop={() =>
										view.triggerSave({ characters: view.characters })
									}
									keyExtractor={(char) => char.id}
									renderItem={(character, isDragging) => (
										<CharacterCard
											character={character}
											isDragging={isDragging}
											onToggleCollapse={view.handleToggleCharacterCollapse}
											onChange={view.handleCharacterChange}
											onDelete={view.handleDeleteCharacter}
											campaignSlug={campaign.slug}
											type="characters"
										/>
									)}
								/>
							)}
						</div>

						<div className="CampaignView__section">
							<div className="section-row">
								<div
									className="section-title-group"
									onClick={() => {
										if (!hasNpcsData) return;
										const next = !isNpcsCollapsed;
										view.setIsNpcsCollapsed(next);
										view.triggerSave({ isNpcsCollapsed: next });
									}}
								>
									{hasNpcsData && (
										<CollapseToggleButton
											size={Button.SIZES.MEDIUM}
											collapsed={isNpcsCollapsed}
											onClick={() => {
												const next = !isNpcsCollapsed;
												view.setIsNpcsCollapsed(next);
												view.triggerSave({ isNpcsCollapsed: next });
											}}
										/>
									)}
									<h3>{lang.t("NPC")}</h3>
								</div>
								{!isNpcsCollapsed && (
									<CreateCharacterButton
										campaignSlug={campaign.slug}
										entityType="npc"
									/>
								)}
							</div>
							{!isNpcsCollapsed && (
								<DraggableList
									items={view.npcs}
									className="CampaignView__characters"
									onReorder={view.setNpcs}
									onDrop={() => {}}
									keyExtractor={(npc) => npc.id}
									renderItem={(npc, isDragging) => (
										<CharacterCard
											character={npc}
											isDragging={isDragging}
											onToggleCollapse={view.handleToggleNpcCollapse}
											onChange={view.handleNpcChange}
											onDelete={view.handleNpcDelete}
											campaignSlug={campaign.slug}
											type="npc"
										/>
									)}
								/>
							)}
						</div>

						<div className="CampaignView__section">
							<div className="section-row">
								<div
									className="section-title-group"
									onClick={() => {
										if (!hasLocationsData) return;
										const next = !isLocationsCollapsed;
										view.setIsLocationsCollapsed(next);
										view.triggerSave({ isLocationsCollapsed: next });
									}}
								>
									{hasLocationsData && (
										<CollapseToggleButton
											size={Button.SIZES.MEDIUM}
											collapsed={isLocationsCollapsed}
											onClick={() => {
												const next = !isLocationsCollapsed;
												view.setIsLocationsCollapsed(next);
												view.triggerSave({ isLocationsCollapsed: next });
											}}
										/>
									)}
									<h3>{lang.t("Locations/Factions")}</h3>
								</div>
								{!isLocationsCollapsed && (
									<CreateLocationButton campaignSlug={campaign.slug} />
								)}
							</div>
							{!isLocationsCollapsed && (
								<DraggableList
									items={view.locations}
									className="CampaignView__characters"
									onReorder={view.setLocations}
									onDrop={() => {}}
									keyExtractor={(location) => location.id}
									renderItem={(location, isDragging) => (
										<LocationCard
											location={location}
											isDragging={isDragging}
											onToggleCollapse={view.handleToggleLocationCollapse}
											onChange={view.handleLocationChange}
											onDelete={view.handleLocationDelete}
											campaignSlug={campaign.slug}
										/>
									)}
								/>
							)}
						</div>

						<div className="CampaignView__section">
							<AiAssistantPanel
								sessionName={campaign.name}
								sessionData={{
									...campaign,
									description: view.description,
									notes: view.notes,
									characters: view.characters,
									npcs: view.npcs,
									locations: view.locations,
								}}
								campaignSlug={campaign.slug}
								sessionId={null}
								onInsertResult={view.handleAiUpdate}
							/>
						</div>
					</div>
				</div>
			</div>
		</Panel>
	);
}

export { CampaignView };
export default CampaignView;
