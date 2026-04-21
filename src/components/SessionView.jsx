import Icon from "./Icon";
import Button from "./Button";
import EditableField from "./EditableField";
import AiAssistantPanel from "./AiAssistantPanel";
import Panel from "./Panel";
import DraggableList from "./DraggableList";
import Modal from "./Modal";
import NoteCard from "./NoteCard";
import CharacterCard from "./CharacterCard";
import CollapseToggleButton from "./CollapseToggleButton";
import TodoSection from "./session/TodoSection";
import TodoItem from "./session/TodoItem";
import SceneCardHeader from "./session/SceneCardHeader";
import SceneCardMedia from "./session/SceneCardMedia";
import SceneCardFields from "./session/SceneCardFields";
import "../assets/components/SessionView.css";
import useSessionView from "../hooks/useSessionView";
import SessionViewModel from "../models/SessionViewModel.js";

function SessionView(props) {
	const sessionViewProps = useSessionView(props);
	const {
		campaign,
		sessionId,
		onBack,
		session,
		isSaving,
		npcToCreate,
		setNpcToCreate,
		isChecklistOpen,
		setIsChecklistOpen,
		undoStack,
		redoStack,
		campaignSlug,
		triggerSave,
		handleUndo,
		handleRedo,
		updateSession,
		updateData,
		addScene,
		updateScene,
		toggleSceneCollapse,
		handleOpenEncounter,
		removeScene,
		handleOpenNpcCreate,
		handleSaveNpc,
		handleNoteTitleChange,
		handleNoteChange,
		handleToggleNoteCollapse,
		handleDeleteNote,
		handleToggleSceneNotesCollapse,
		handleSceneNoteTitleChange,
		handleSceneNoteChange,
		handleSceneToggleNoteCollapse,
		handleSceneDeleteNote,
		handleToggleSectionCollapse,
		handleAiUpdate,
		checklistItems,
		progress,
		handleRename,
		handleDeleteSessionAndBack,
	} = { ...props, ...sessionViewProps };

	if (!session) return null;
	const viewModel = new SessionViewModel({ ...session, isSaving });

	return (
		<Panel className="SessionView">
			<div className="Panel__header">
				<div className="SessionView__header">
					<div className="SessionView__titleGroup">
						<div className="SessionView__titleRow">
							<Button
								variant="ghost"
								size="small"
								onClick={onBack}
								icon="back"
								className="SessionView__backBtn"
							/>
							<h2 className="editable-title" onClick={handleRename}>
								{session.name}
							</h2>
						</div>
						<p className="muted">{viewModel.saveStatusLabel}</p>
					</div>
				</div>
				<div className="SessionView__headerActions">
					<Button
						variant="ghost"
						size="small"
						icon="undo"
						onClick={handleUndo}
						disabled={undoStack.length === 0 || isSaving}
						title="Скасувати (Ctrl+Z)"
					/>
					<Button
						variant="ghost"
						size="small"
						icon="redo"
						onClick={handleRedo}
						disabled={redoStack.length === 0 || isSaving}
						title="Повторити (Ctrl+Y)"
					/>
					<Button
						variant={viewModel.isCompleted ? "primary" : ""}
						onClick={() =>
							updateSession({ completed: !session.completed }, true)
						}>
						{viewModel.completeButtonLabel}
					</Button>
					<Button
						variant="danger"
						icon="trash"
						onClick={handleDeleteSessionAndBack}
					/>
				</div>
			</div>

			<div className="Panel__body">
				<div className="SessionView__todoList">
					<TodoSection
						title="Замітки"
						collapsed={!!session.data.isNotesCollapsed}
						onToggle={() => handleToggleSectionCollapse("Notes")}>
						{!session.data.isNotesCollapsed && (
							<DraggableList
								items={viewModel.notes}
								className="SessionView__notes"
								onReorder={(notes) => updateData("notes", notes)}
								onDrop={() => triggerSave(session, true)}
								keyExtractor={(note) => note.id}
								renderItem={(note, isDragging, index) => (
									<NoteCard
										note={note}
										isLast={index === viewModel.notes.length - 1}
										isDragging={isDragging}
										onToggleCollapse={handleToggleNoteCollapse}
										onTitleChange={handleNoteTitleChange}
										onTextChange={handleNoteChange}
										onDelete={handleDeleteNote}
									/>
								)}
							/>
						)}
					</TodoSection>
					<TodoSection
						title="Сцени"
						action={
							<Button
								variant="primary"
								size="small"
								onClick={addScene}
								icon="plus"
								iconSize={16}>
								Додати
							</Button>
						}>
						<AiAssistantPanel
							sessionName={session.name}
							sessionData={session.data}
							campaignContext={{
								description: campaign.description,
								notes: campaign.notes,
							}}
							campaignSlug={campaignSlug}
							sessionId={sessionId}
							onInsertResult={handleAiUpdate}
						/>
						<DraggableList
							items={viewModel.scenes}
							onReorder={(newScenes) => updateData("scenes", newScenes)}
							onDrop={() => triggerSave(session, true)}
							keyExtractor={(scene) => scene.id}
							renderItem={(scene) => {
								const idx = viewModel.scenes.findIndex(
									(s) => s.id === scene.id,
								);
								return (
									<SceneCard
										number={idx + 1}
										scene={scene}
										fields={SessionViewModel.sceneSchema}
										collapsed={scene.collapsed}
										onToggle={() => toggleSceneCollapse(scene.id)}
										onRemove={() => removeScene(scene.id)}
										onOpenEncounter={() => handleOpenEncounter(scene)}
										handleOpenNpcCreate={handleOpenNpcCreate}
										imageUrl={scene.imageUrl}
										onImageChange={(url) =>
											updateScene(scene.id, "imageUrl", url, true)
										}
										campaignSlug={campaignSlug}
										hasEncounter={!!scene.encounterId}
										encounterName={viewModel.findEncounterName(scene)}
										onUpdateField={(field, value) =>
											updateScene(scene.id, field, value)
										}
										onToggleNotesCollapse={() =>
											handleToggleSceneNotesCollapse(scene.id)
										}
										onSceneNoteTitleChange={(noteId, title) =>
											handleSceneNoteTitleChange(scene.id, noteId, title)
										}
										onSceneNoteChange={(noteId, text) =>
											handleSceneNoteChange(scene.id, noteId, text)
										}
										onSceneNoteToggleCollapse={(noteId) =>
											handleSceneToggleNoteCollapse(scene.id, noteId)
										}
										onSceneNoteDelete={(noteId) =>
											handleSceneDeleteNote(scene.id, noteId)
										}
									/>
								);
							}}
						/>
					</TodoSection>

					<TodoSection title="Результат сесії">
						<EditableField
							type="textarea"
							className="field--result"
							placeholder="Підсумок того, що реально відбулося..."
							value={session.data.result_text || ""}
							onChange={(e) => updateData("result_text", e.target.value)}
						/>
					</TodoSection>
				</div>
			</div>

			{isChecklistOpen && (
				<Modal
					title="Чекліст підготовки"
					onCancel={() => setIsChecklistOpen(false)}
					showFooter={false}>
					<div className="SessionView__checklistModal">
						<div className="SessionView__progressWrap">
							<div className="ProgressBar__label">
								<span>Прогрес підготовки</span>
								<span>{progress}%</span>
							</div>
							<div className="ProgressBar">
								<div
									className="ProgressBar__fill"
									style={{ width: `${progress}%` }}></div>
							</div>
						</div>
						{checklistItems.map((item) => (
							<TodoItem
								key={item.id}
								checked={!!session.data[`${item.id}_check`]}
								onChange={(val) => updateData(`${item.id}_check`, val, true)}
								title={item.label}
								note={item.note}
							/>
						))}
					</div>
				</Modal>
			)}

			<button
				className="SessionView__checklistToggle"
				onClick={() => setIsChecklistOpen(true)}
				title="Чекліст підготовки">
				<Icon name="list" size={28} />
				{progress < 100 && <span className="SessionView__checklistBadge" />}
			</button>

			{npcToCreate && (
				<Modal
					title="Створити нового NPC"
					onCancel={() => setNpcToCreate(null)}
					onConfirm={handleSaveNpc}
					confirmLabel="Зберегти NPC">
					<CharacterCard
						character={npcToCreate}
						onChange={(id, updated) => setNpcToCreate(updated)}
						onDelete={() => setNpcToCreate(null)}
						onToggleCollapse={() => {}}
						campaignSlug={campaignSlug}
						type="npc"
						initialEditing={true}
					/>
				</Modal>
			)}
		</Panel>
	);
}

export { SessionView };
export default SessionView;

function SceneCard({
	number,
	scene,
	fields,
	onRemove,
	collapsed,
	onToggle,
	onOpenEncounter,
	hasEncounter,
	encounterName,
	handleOpenNpcCreate,
	imageUrl,
	onImageChange,
	campaignSlug,
	onUpdateField,
	onToggleNotesCollapse,
	onSceneNoteTitleChange,
	onSceneNoteChange,
	onSceneNoteToggleCollapse,
	onSceneNoteDelete,
}) {
	const encounterLabel = hasEncounter ? encounterName : "Encounter";

	return (
		<div className="SceneCard">
			<SceneCardHeader
				number={number}
				collapsed={collapsed}
				onToggle={onToggle}
				onOpenNpcCreate={handleOpenNpcCreate}
				onOpenEncounter={onOpenEncounter}
				onRemove={onRemove}
				hasEncounter={hasEncounter}
				encounterName={encounterLabel}
			/>
			{!collapsed && (
				<div className="SceneCard__content">
					<div className="SceneCard__text-side">
						<SceneCardFields
							fields={fields}
							scene={scene}
							onUpdateField={onUpdateField}
						/>
						<div className="SceneCard__notes">
							<div
								className="SceneCard__notes-header"
								onClick={onToggleNotesCollapse}>
								<CollapseToggleButton
									size="sm"
									collapsed={scene.isNotesCollapsed}
									onClick={onToggleNotesCollapse}
								/>
								<label>Замітки сцени</label>
							</div>
							{!scene.isNotesCollapsed && (
								<div className="SceneCard__notes-list">
									{(scene.notes || []).map((note, index) => (
										<NoteCard
											key={note.id}
											note={note}
											isLast={index === (scene.notes || []).length - 1}
											onToggleCollapse={onSceneNoteToggleCollapse}
											onTitleChange={onSceneNoteTitleChange}
											onTextChange={onSceneNoteChange}
											onDelete={onSceneNoteDelete}
										/>
									))}
								</div>
							)}
						</div>
					</div>
					<SceneCardMedia
						number={number}
						imageUrl={imageUrl}
						campaignSlug={campaignSlug}
						onImageChange={onImageChange}
					/>
				</div>
			)}

		</div>
	);
}
