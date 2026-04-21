import { useMemo, useState } from "react";
import AiAssistantPanel from "./AiAssistantPanel";
import Button from "./Button";
import EditableField from "./EditableField";
import ListCard from "./ListCard";
import Panel from "./Panel";
import StatusBadge from "./StatusBadge";
import DraggableList from "./DraggableList";
import NoteCard from "./NoteCard";
import CharacterCard from "./CharacterCard";
import CollapseToggleButton from "./CollapseToggleButton";
import Tooltip from "./Tooltip";
import "../assets/components/CampaignView.css";
import useCampaignView from "../hooks/useCampaignView";
import CampaignViewModel from "../models/CampaignViewModel.js";

function CampaignView(props) {
	const campaignViewProps = useCampaignView(props);
	const {
		campaign,
		onSelectSession,
		sessions,
		setSessions,
		description,
		notes,
		setNotes,
		characters,
		setCharacters,
		npcs,
		setNpcs,
		isDescriptionCollapsed,
		setIsDescriptionCollapsed,
		isNotesCollapsed,
		setIsNotesCollapsed,
		isCharactersCollapsed,
		setIsCharactersCollapsed,
		isNpcsCollapsed,
		setIsNpcsCollapsed,
		undoStack,
		redoStack,
		handleUndo,
		handleRedo,
		triggerSave,
		handleDescriptionChange,
		handleToggleNoteCollapse,
		handleNoteTitleChange,
		handleNoteChange,
		handleDeleteNote,
		handleAddCharacter,
		handleToggleCharacterCollapse,
		handleCharacterChange,
		handleDeleteCharacter,
		handleAddNpc,
		handleToggleNpcCollapse,
		handleNpcChange,
		handleNpcDelete,
		handleCreateSession,
		handleDeleteCampaign,
		handleRename,
		handleDeleteSession,
		handleToggleSessionStatus,
		handleExport,
		handleAiUpdate,
		handleSessionReorderDrop,
	} = { ...props, ...campaignViewProps };

	const viewModel = new CampaignViewModel(campaign);
	const [sessionSearch, setSessionSearch] = useState("");
	const [sessionStatusFilter, setSessionStatusFilter] = useState("all");

	const filteredSessions = useMemo(() => {
		const query = sessionSearch.trim().toLowerCase();
		return sessions.filter((session) => {
			const matchesQuery =
				!query || String(session.name || "").toLowerCase().includes(query);
			const matchesStatus =
				sessionStatusFilter === "all"
					? true
					: sessionStatusFilter === "completed"
						? !!session.completed
						: !session.completed;
			return matchesQuery && matchesStatus;
		});
	}, [sessions, sessionSearch, sessionStatusFilter]);

	const canReorderSessions =
		sessionStatusFilter === "all" && sessionSearch.trim().length === 0;

	const renderSessionCard = (session, isDragging = false) => (
		<ListCard
			key={session.fileName}
			href={viewModel.buildSessionHref(session.fileName)}
			dragging={isDragging}
			onClick={() => onSelectSession(session.fileName)}
			actions={
				<>
					<StatusBadge
						completed={session.completed}
						onClick={() => handleToggleSessionStatus(session)}
						type="session"
					/>
					<Button
						variant="danger"
						icon="trash"
						size={16}
						onClick={(e) => {
							e.stopPropagation();
							handleDeleteSession(session);
						}}
						title="Видалити сесію"
					/>
				</>
			}>
			<div className="ListCard__title">{session.name}</div>
			<div className="ListCard__meta">
				Оновлено: {viewModel.formatSessionUpdatedAt(session.updatedAt)}
			</div>
		</ListCard>
	);

	return (
		<Panel className="CampaignView">
			<div className="Panel__header">
				<div className="CampaignView__header">
					<Tooltip content="Натисни, щоб перейменувати">
						<h2
							className="editable-title"
							onClick={handleRename}>
							{viewModel.name}
						</h2>
					</Tooltip>
					<p className="muted">Створено: {viewModel.createdAtLabel}</p>
				</div>
				<div className="CampaignView__headerActions">
					<Button
						variant="ghost"
						size="small"
						icon="undo"
						onClick={handleUndo}
						disabled={undoStack.length === 0}
						title="Скасувати (Ctrl+Z)"
					/>
					<Button
						variant="ghost"
						size="small"
						icon="redo"
						onClick={handleRedo}
						disabled={redoStack.length === 0}
						title="Повторити (Ctrl+Y)"
					/>
					<Button onClick={handleExport} icon="export">
						Експорт
					</Button>
					<Button
						variant="danger"
						icon="trash"
						onClick={handleDeleteCampaign}
						title="Видалити кампанію"
					/>
				</div>
			</div>
			<div className="Panel__body">
				<div className="CampaignView__layout">
					<aside className="CampaignView__sessionsPane" id="campaign-sessions">
						<div className="CampaignView__sessionsPaneHeader">
							<h3>Сесії</h3>
							<Button
								variant="create"
								onClick={handleCreateSession}
								icon="plus"
								size="small"
								strokeWidth={2.5}>
								Нова сесія
							</Button>
						</div>
						<div className="CampaignView__sessionsPaneControls">
							<input
								className="CampaignView__sessionSearch"
								placeholder="Пошук сесій..."
								value={sessionSearch}
								onChange={(e) => setSessionSearch(e.target.value)}
							/>
							<div className="CampaignView__sessionFilterRow">
								<Button
									variant={sessionStatusFilter === "all" ? "primary" : "ghost"}
									size="small"
									onClick={() => setSessionStatusFilter("all")}>
									Всі
								</Button>
								<Button
									variant={sessionStatusFilter === "active" ? "primary" : "ghost"}
									size="small"
									onClick={() => setSessionStatusFilter("active")}>
									Активні
								</Button>
								<Button
									variant={sessionStatusFilter === "completed" ? "primary" : "ghost"}
									size="small"
									onClick={() => setSessionStatusFilter("completed")}>
									Завершені
								</Button>
							</div>
						</div>
						<div className="CampaignView__sessionsPaneList">
							{canReorderSessions ? (
								<DraggableList
									items={filteredSessions}
									onReorder={setSessions}
									onDrop={handleSessionReorderDrop}
									keyExtractor={(session) => session.fileName}
									renderItem={(session, isDragging) =>
										renderSessionCard(session, isDragging)
									}
								/>
							) : (
								<div className="CampaignView__sessions">
									{filteredSessions.map((session) => renderSessionCard(session))}
								</div>
							)}
							{filteredSessions.length === 0 && (
								<div className="muted CampaignView__emptySessions">
									Сесій не знайдено.
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
										const next = !isDescriptionCollapsed;
										setIsDescriptionCollapsed(next);
										triggerSave({ isDescriptionCollapsed: next });
									}}>
									<CollapseToggleButton
										size="md"
										collapsed={isDescriptionCollapsed}
										onClick={() => {
											const next = !isDescriptionCollapsed;
											setIsDescriptionCollapsed(next);
											triggerSave({ isDescriptionCollapsed: next });
										}}
									/>
									<h3>Сюжет кампанії</h3>
								</div>
							</div>
							{!isDescriptionCollapsed && (
								<EditableField
									type="textarea"
									className="CampaignView__script"
									placeholder="Опишіть основну лінію сюжету, ключові події та цілі..."
									value={description}
									onChange={handleDescriptionChange}
								/>
							)}
						</div>

						<div className="CampaignView__section">
							<div className="section-row">
								<div
									className="section-title-group"
									onClick={() => {
										const next = !isNotesCollapsed;
										setIsNotesCollapsed(next);
										triggerSave({ isNotesCollapsed: next });
									}}>
									<CollapseToggleButton
										size="md"
										collapsed={isNotesCollapsed}
										onClick={() => {
											const next = !isNotesCollapsed;
											setIsNotesCollapsed(next);
											triggerSave({ isNotesCollapsed: next });
										}}
									/>
									<h3>Замітки</h3>
								</div>
							</div>
							{!isNotesCollapsed && (
								<DraggableList
									items={notes}
									className="CampaignView__notes"
									onReorder={setNotes}
									onDrop={() => triggerSave({ notes })}
									keyExtractor={(note) => note.id}
									renderItem={(note, isDragging, index) => (
										<NoteCard
											note={note}
											isLast={index === notes.length - 1}
											isDragging={isDragging}
											onToggleCollapse={handleToggleNoteCollapse}
											onTitleChange={handleNoteTitleChange}
											onTextChange={handleNoteChange}
											onDelete={handleDeleteNote}
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
										const next = !isCharactersCollapsed;
										setIsCharactersCollapsed(next);
										triggerSave({ isCharactersCollapsed: next });
									}}>
									<CollapseToggleButton
										size="md"
										collapsed={isCharactersCollapsed}
										onClick={() => {
											const next = !isCharactersCollapsed;
											setIsCharactersCollapsed(next);
											triggerSave({ isCharactersCollapsed: next });
										}}
									/>
									<h3>Персонажі</h3>
								</div>
								{!isCharactersCollapsed && (
									<Button
										variant="primary"
										size="small"
										onClick={handleAddCharacter}
										icon="plus"
										strokeWidth={2.5}>
										Новий персонаж
									</Button>
								)}
							</div>
							{!isCharactersCollapsed && (
								<DraggableList
									items={characters}
									className="CampaignView__characters"
									onReorder={setCharacters}
									onDrop={() => triggerSave({ characters })}
									keyExtractor={(char) => char.id}
									renderItem={(character, isDragging) => (
										<CharacterCard
											character={character}
											isDragging={isDragging}
											onToggleCollapse={handleToggleCharacterCollapse}
											onChange={handleCharacterChange}
											onDelete={handleDeleteCharacter}
											campaignSlug={campaign.slug}
											type="characters"
											initialEditing={character._isNew}
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
										const next = !isNpcsCollapsed;
										setIsNpcsCollapsed(next);
										triggerSave({ isNpcsCollapsed: next });
									}}>
									<CollapseToggleButton
										size="md"
										collapsed={isNpcsCollapsed}
										onClick={() => {
											const next = !isNpcsCollapsed;
											setIsNpcsCollapsed(next);
											triggerSave({ isNpcsCollapsed: next });
										}}
									/>
									<h3>NPC</h3>
								</div>
								{!isNpcsCollapsed && (
									<Button
										variant="primary"
										size="small"
										onClick={handleAddNpc}
										icon="plus"
										strokeWidth={2.5}>
										Новий NPC
									</Button>
								)}
							</div>
							{!isNpcsCollapsed && (
								<DraggableList
									items={npcs}
									className="CampaignView__characters"
									onReorder={setNpcs}
									onDrop={() => {}}
									keyExtractor={(npc) => npc.id}
									renderItem={(npc, isDragging) => (
										<CharacterCard
											character={npc}
											isDragging={isDragging}
											onToggleCollapse={handleToggleNpcCollapse}
											onChange={handleNpcChange}
											onDelete={handleNpcDelete}
											campaignSlug={campaign.slug}
											type="npc"
											initialEditing={npc._isNew}
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
									description,
									notes,
									characters,
									npcs,
								}}
								campaignSlug={campaign.slug}
								sessionId={null}
								onInsertResult={handleAiUpdate}
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
