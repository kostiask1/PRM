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
import CollapseToggleButton from "./common/CollapseToggleButton.jsx";
import Tooltip from "./common/Tooltip.jsx";
import CreateCharacterButton from "./CreateCharacterButton";
import "../assets/components/CampaignView.css";
import useCampaignView from "../hooks/useCampaignView";
import CampaignViewModel from "../models/CampaignViewModel.js";
import { navigateTo } from "../store/appStore";
import { lang } from "../services/localization";

function CampaignView(props) {
	const campaign = props.campaign;
	const view = useCampaignView(props);
	const viewModel = new CampaignViewModel(campaign);
	const [sessionSearch, setSessionSearch] = useState("");
	const [sessionStatusFilter, setSessionStatusFilter] = useState("all");

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

					<div className="CampaignView__contentPane">
						<div className="CampaignView__section">
							<div className="section-row">
								<div
									className="section-title-group"
									onClick={() => {
										const next = !view.isDescriptionCollapsed;
										view.setIsDescriptionCollapsed(next);
										view.triggerSave({ isDescriptionCollapsed: next });
									}}
								>
									<CollapseToggleButton
										size={Button.SIZES.MEDIUM}
										collapsed={view.isDescriptionCollapsed}
										onClick={() => {
											const next = !view.isDescriptionCollapsed;
											view.setIsDescriptionCollapsed(next);
											view.triggerSave({ isDescriptionCollapsed: next });
										}}
									/>
									<h3>{lang.t("Campaign story")}</h3>
								</div>
							</div>
							{!view.isDescriptionCollapsed && (
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
										const next = !view.isNotesCollapsed;
										view.setIsNotesCollapsed(next);
										view.triggerSave({ isNotesCollapsed: next });
									}}
								>
									<CollapseToggleButton
										size={Button.SIZES.MEDIUM}
										collapsed={view.isNotesCollapsed}
										onClick={() => {
											const next = !view.isNotesCollapsed;
											view.setIsNotesCollapsed(next);
											view.triggerSave({ isNotesCollapsed: next });
										}}
									/>
									<h3>{lang.t("Notes")}</h3>
								</div>
							</div>
							{!view.isNotesCollapsed && (
								<DraggableList
									items={view.notes}
									className="CampaignView__notes"
									onReorder={view.setNotes}
									onDrop={() => view.triggerSave({ notes: view.notes })}
									keyExtractor={(note) => note.id}
									renderItem={(note, isDragging, index) => (
										<NoteCard
											note={note}
											isLast={index === view.notes.length - 1}
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
										const next = !view.isCharactersCollapsed;
										view.setIsCharactersCollapsed(next);
										view.triggerSave({ isCharactersCollapsed: next });
									}}
								>
									<CollapseToggleButton
										size={Button.SIZES.MEDIUM}
										collapsed={view.isCharactersCollapsed}
										onClick={() => {
											const next = !view.isCharactersCollapsed;
											view.setIsCharactersCollapsed(next);
											view.triggerSave({ isCharactersCollapsed: next });
										}}
									/>
									<h3>{lang.t("Characters")}</h3>
								</div>
								{!view.isCharactersCollapsed && (
									<CreateCharacterButton
										campaignSlug={campaign.slug}
										entityType="characters"
									/>
								)}
							</div>
							{!view.isCharactersCollapsed && (
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
										const next = !view.isNpcsCollapsed;
										view.setIsNpcsCollapsed(next);
										view.triggerSave({ isNpcsCollapsed: next });
									}}
								>
									<CollapseToggleButton
										size={Button.SIZES.MEDIUM}
										collapsed={view.isNpcsCollapsed}
										onClick={() => {
											const next = !view.isNpcsCollapsed;
											view.setIsNpcsCollapsed(next);
											view.triggerSave({ isNpcsCollapsed: next });
										}}
									/>
									<h3>{lang.t("NPC")}</h3>
								</div>
								{!view.isNpcsCollapsed && (
									<CreateCharacterButton
										campaignSlug={campaign.slug}
										entityType="npc"
									/>
								)}
							</div>
							{!view.isNpcsCollapsed && (
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
							<AiAssistantPanel
								sessionName={campaign.name}
								sessionData={{
									...campaign,
									description: view.description,
									notes: view.notes,
									characters: view.characters,
									npcs: view.npcs,
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
