import AiAssistantPanel from "./AiAssistantPanel";
import Button from "./Button";
import EditableField from "./EditableField";
import ListCard from "./ListCard";
import Panel from "./Panel";
import StatusBadge from "./StatusBadge";
import DraggableList from "./DraggableList";
import NoteCard from "./NoteCard";
import CharacterCard from "./CharacterCard";
import "../assets/components/CampaignView.css";
import withCampaignView from "../hoc/withCampaignView";
import CampaignViewModel from "../models/CampaignViewModel.js";

function CampaignView({
	campaign,
	onSelectSession,
	modal,
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
}) {
	const viewModel = new CampaignViewModel(campaign);

	return (
		<Panel className="CampaignView">
			<div className="Panel__header">
				<div>
					<h2
						className="editable-title"
						onClick={handleRename}
						title="Натисни, щоб перейменувати">
						{viewModel.name}
					</h2>
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
				<div className="CampaignView__section">
					<div className="section-row">
						<div
							className="section-title-group"
							onClick={() => {
								const next = !isDescriptionCollapsed;
								setIsDescriptionCollapsed(next);
								triggerSave({ isDescriptionCollapsed: next });
							}}>
							<Button
								variant="ghost"
								size="small"
								icon="chevron"
								className={`section-collapse-toggle ${isDescriptionCollapsed ? "is-rotated" : ""}`}
								onClick={(e) => {
									e.stopPropagation();
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
							<Button
								variant="ghost"
								size="small"
								icon="chevron"
								className={`section-collapse-toggle ${isNotesCollapsed ? "is-rotated" : ""}`}
								onClick={(e) => {
									e.stopPropagation();
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
							<Button
								variant="ghost"
								size="small"
								icon="chevron"
								className={`section-collapse-toggle ${isCharactersCollapsed ? "is-rotated" : ""}`}
								onClick={(e) => {
									e.stopPropagation();
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
									modal={modal}
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
							<Button
								variant="ghost"
								size="small"
								icon="chevron"
								className={`section-collapse-toggle ${isNpcsCollapsed ? "is-rotated" : ""}`}
								onClick={(e) => {
									e.stopPropagation();
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
									modal={modal}
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
						modal={modal}
					/>
				</div>

				<div className="section-row">
					<h3>Сесії</h3>
				</div>
				<div className="CampaignView__sessions">
					<DraggableList
						items={sessions}
						onReorder={setSessions}
						onDrop={handleSessionReorderDrop}
						keyExtractor={(session) => session.fileName}
						renderItem={(session, isDragging) => (
							<ListCard
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
						)}
					/>
					<Button
						variant="create"
						onClick={handleCreateSession}
						icon="plus"
						strokeWidth={2.5}>
						Нова сесія
					</Button>
				</div>
			</div>
		</Panel>
	);
}

export { CampaignView };
const CampaignViewWithHOC = withCampaignView(CampaignView);
export default CampaignViewWithHOC;
