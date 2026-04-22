import Icon from "./common/Icon.jsx";
import Button from "./form/Button";
import EditableField from "./form/EditableField";
import AiAssistantPanel from "./AiAssistantPanel";
import Panel from "./common/Panel.jsx";
import DraggableList from "./common/DraggableList.jsx";
import Modal from "./common/Modal.jsx";
import NoteCard from "./common/NoteCard.jsx";
import CollapseToggleButton from "./common/CollapseToggleButton.jsx";
import TodoSection from "./session/TodoSection";
import TodoItem from "./session/TodoItem";
import SceneCardHeader from "./session/SceneCardHeader";
import SceneCardMedia from "./session/SceneCardMedia";
import SceneCardFields from "./session/SceneCardFields";
import Tooltip from "./common/Tooltip.jsx";
import "../assets/components/SessionView.css";
import useSessionView from "../hooks/useSessionView";
import SessionViewModel from "../models/SessionViewModel.js";

function SessionView(props) {
	const campaign = props.campaign;
	const sessionId = props.sessionId;
	const view = useSessionView(props);
	const session = view.session;

	if (!session) return null;
	const viewModel = new SessionViewModel({ ...session, isSaving: view.isSaving });

	return (
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
							<h2 className="editable-title" onClick={view.handleRename}>
								{session.name}
							</h2>
						</div>
						<p className="muted">{viewModel.saveStatusLabel}</p>
					</div>
				</div>
				<div className="SessionView__headerActions">
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="undo"
						onClick={view.handleUndo}
						disabled={view.undoStack.length === 0 || view.isSaving}
						title="Скасувати (Ctrl+Z)"
					/>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="redo"
						onClick={view.handleRedo}
						disabled={view.redoStack.length === 0 || view.isSaving}
						title="Повторити (Ctrl+Y)"
					/>
					<Button
						variant={viewModel.isCompleted ? "primary" : ""}
						onClick={() => view.updateSession({ completed: !session.completed }, true)}>
						{viewModel.completeButtonLabel}
					</Button>
					<Button
						variant="danger"
						icon="trash"
						onClick={view.handleDeleteSessionAndBack}
					/>
				</div>
			</div>

			<div className="Panel__body">
				<div className="SessionView__todoList">
					<TodoSection
						title="Замітки"
						collapsed={!!session.data.isNotesCollapsed}
						onToggle={() => view.handleToggleSectionCollapse("Notes")}>
						{!session.data.isNotesCollapsed && (
							<DraggableList
								items={viewModel.notes}
								className="SessionView__notes"
								onReorder={(notes) => view.updateData("notes", notes)}
								onDrop={() => view.triggerSave(session, true)}
								keyExtractor={(note) => note.id}
								renderItem={(note, isDragging, index) => (
									<NoteCard
										note={note}
										isLast={index === viewModel.notes.length - 1}
										isDragging={isDragging}
										onToggleCollapse={view.handleToggleNoteCollapse}
										onTitleChange={view.handleNoteTitleChange}
										onTextChange={view.handleNoteChange}
										onDelete={view.handleDeleteNote}
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
								size={Button.SIZES.SMALL}
								onClick={view.addScene}
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
							campaignSlug={view.campaignSlug}
							sessionId={sessionId}
							onInsertResult={view.handleAiUpdate}
						/>
						<DraggableList
							items={viewModel.scenes}
							onReorder={(newScenes) => view.updateData("scenes", newScenes)}
							onDrop={() => view.triggerSave(session, true)}
							keyExtractor={(scene) => scene.id}
							renderItem={(scene) => {
								const idx = viewModel.scenes.findIndex((s) => s.id === scene.id);
								return (
									<SceneCard
										number={idx + 1}
										scene={scene}
										fields={SessionViewModel.sceneSchema}
										collapsed={scene.collapsed}
										onToggle={() => view.toggleSceneCollapse(scene.id)}
										onRemove={() => view.removeScene(scene.id)}
										onOpenEncounter={() => view.handleOpenEncounter(scene)}
										imageUrl={scene.imageUrl}
										onImageChange={(url) =>
											view.updateScene(scene.id, "imageUrl", url, true)
										}
										campaignSlug={view.campaignSlug}
										hasEncounter={!!scene.encounterId}
										encounterName={viewModel.findEncounterName(scene)}
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
										onSceneNoteToggleCollapse={(noteId) =>
											view.handleSceneToggleNoteCollapse(scene.id, noteId)
										}
										onSceneNoteDelete={(noteId) =>
											view.handleSceneDeleteNote(scene.id, noteId)
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
							onChange={(e) => view.updateData("result_text", e.target.value)}
						/>
					</TodoSection>
				</div>
			</div>

			{view.isChecklistOpen && (
				<Modal
					title="Чекліст підготовки"
					onCancel={() => view.setIsChecklistOpen(false)}
					showFooter={false}>
					<div className="SessionView__checklistModal">
						<div className="SessionView__progressWrap">
							<div className="ProgressBar__label">
								<span>Прогрес підготовки</span>
								<span>{view.progress}%</span>
							</div>
							<div className="ProgressBar">
								<div
									className="ProgressBar__fill"
									style={{ width: `${view.progress}%` }}></div>
							</div>
						</div>
						{view.checklistItems.map((item) => (
							<TodoItem
								key={item.id}
								checked={!!session.data[`${item.id}_check`]}
								onChange={(val) => view.updateData(`${item.id}_check`, val, true)}
								title={item.label}
								note={item.note}
							/>
						))}
					</div>
				</Modal>
			)}

			<Tooltip
				content="Чекліст підготовки"
				className="SessionView__checklistToggle">
				<button onClick={() => view.setIsChecklistOpen(true)}>
					<Icon name="list" size={28} />
					{view.progress < 100 && <span className="SessionView__checklistBadge" />}
				</button>
			</Tooltip>
		</Panel>
	);
}

export { SessionView };
export default SessionView;

function SceneCard(props) {
	const encounterLabel = props.hasEncounter ? props.encounterName : "Encounter";

	return (
		<div className="SceneCard">
			<SceneCardHeader
				number={props.number}
				collapsed={props.collapsed}
				onToggle={props.onToggle}
				campaignSlug={props.campaignSlug}
				onOpenEncounter={props.onOpenEncounter}
				onRemove={props.onRemove}
				hasEncounter={props.hasEncounter}
				encounterName={encounterLabel}
			/>
			{!props.collapsed && (
				<div className="SceneCard__content">
					<div className="SceneCard__text-side">
						<SceneCardFields
							fields={props.fields}
							scene={props.scene}
							onUpdateField={props.onUpdateField}
						/>
						<div className="SceneCard__notes">
							<div
								className="SceneCard__notes-header"
								onClick={props.onToggleNotesCollapse}>
								<CollapseToggleButton
									size={Button.SIZES.SMALL}
									collapsed={props.scene.isNotesCollapsed}
									onClick={props.onToggleNotesCollapse}
								/>
								<label>Замітки сцени</label>
							</div>
							{!props.scene.isNotesCollapsed && (
								<div className="SceneCard__notes-list">
									{(props.scene.notes || []).map((note, index) => (
										<NoteCard
											key={note.id}
											note={note}
											isLast={index === (props.scene.notes || []).length - 1}
											onToggleCollapse={props.onSceneNoteToggleCollapse}
											onTitleChange={props.onSceneNoteTitleChange}
											onTextChange={props.onSceneNoteChange}
											onDelete={props.onSceneNoteDelete}
										/>
									))}
								</div>
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
