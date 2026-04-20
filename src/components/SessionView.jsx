import { useState } from "react";
import Icon from "./Icon";
import Button from "./Button";
import EditableField from "./EditableField";
import AiAssistantPanel from "./AiAssistantPanel";
import Panel from "./Panel";
import DraggableList from "./DraggableList";
import Modal from "./Modal";
import NoteCard from "./NoteCard";
import ImageDropzone from "./ImageDropzone";
import ImageGallery from "./ImageGallery";
import CharacterCard from "./CharacterCard";
import Checkbox from "./Checkbox";
import "../assets/components/SessionView.css";
import withSessionView from "../hoc/withSessionView";
import SessionViewModel from "../models/SessionViewModel.js";

function SessionView({
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
	handleToggleSectionCollapse,
	handleAiUpdate,
	checklistItems,
	progress,
	handleRename,
	handleDeleteSessionAndBack,
}) {
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
						onClick={() => updateSession({ completed: !session.completed }, true)}>
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
								const idx = viewModel.scenes.findIndex((s) => s.id === scene.id);
								return (
									<SceneCard
										number={idx + 1}
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
										onTriggerSave={() => triggerSave(session, true)}>
										{SessionViewModel.sceneSchema.map((field) => (
											<div key={field.key} className="TodoItem__content">
												<div className="TodoItem__title">{field.title}</div>
												<EditableField
													type={field.type}
													value={scene.texts?.[field.key] || ""}
													onChange={(e) =>
														updateScene(scene.id, field.key, e.target.value)
													}
													placeholder={field.placeholder}
												/>
											</div>
										))}
									</SceneCard>
								);
							}}
						/>
					</TodoSection>

					<TodoSection title="Результат сесії">
						<div className="TodoItem__note">
							Запиши короткий підсумок того, що реально відбулося.
						</div>
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
const SessionViewWithHOC = withSessionView(SessionView);
export default SessionViewWithHOC;

function TodoSection({ title, children, action }) {
	return (
		<section className="TodoSection">
			<div className="TodoSection__header">
				<h3>{title}</h3>
				{action}
			</div>
			{children && <div className="TodoSection__body">{children}</div>}
		</section>
	);
}

function TodoItem({ title, note, checked, onChange, children }) {
	return (
		<div className={`TodoItem ${checked ? "TodoItem--done" : ""}`}>
			<Checkbox
				checked={checked}
				onChange={onChange}
				label={
					<div className="TodoItem__content">
						<div className="TodoItem__trigger">
							{title && <div className="TodoItem__title">{title}</div>}
							{note && <div className="TodoItem__note">{note}</div>}
						</div>
						{children}
					</div>
				}
			/>
		</div>
	);
}

function SceneCard({
	number,
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
	children,
}) {
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);

	return (
		<div className="SceneCard">
			<div className="SceneCard__header" onClick={onToggle}>
				<div className="SceneCard__titleGroup">
					<div className="SceneCard__toggle">
						<Icon name="chevron" className={collapsed ? "Icon--rotated" : ""} />
					</div>
					<div className="SceneCard__title">Сцена {number}</div>
				</div>
				<div className="SceneCard__headerActions">
					<Button
						variant="ghost"
						onClick={handleOpenNpcCreate}
						icon="plus"
						strokeWidth={2.5}>
						Створити NPC
					</Button>
					<Button
						variant={hasEncounter ? "primary" : "ghost"}
						onClick={(e) => {
							e.stopPropagation();
							onOpenEncounter();
						}}
						title={
							hasEncounter ? "Відкрити зіткнення" : "Додати бойове зіткнення"
						}>
						<Icon
							name="swords"
							size={18}
							className="SceneCard__encounter-icon"
						/>
						<span className="SceneCard__encounter-name">
							{hasEncounter ? encounterName : "Додати бій"}
						</span>
					</Button>
					<Button
						variant="danger"
						icon="x"
						iconSize={16}
						onClick={(e) => {
							e.stopPropagation();
							onRemove();
						}}
					/>
				</div>
			</div>
			{!collapsed && (
				<div className="SceneCard__content">
					<div className="SceneCard__image-side">
						<div className="SceneCard__portrait-container">
							{imageUrl ? (
								<div className="SceneCard__portrait-wrapper">
									<img
										src={imageUrl}
										alt={`Scene ${number}`}
										onClick={(e) => {
											e.stopPropagation();
											setIsGalleryOpen(true);
										}}
									/>
									<Button
										variant="danger"
										size="small"
										icon="x"
										onClick={(e) => {
											e.stopPropagation();
											onImageChange(null);
										}}
										className="SceneCard__image-delete"
										title="Видалити зображення"
									/>
								</div>
							) : (
								<ImageDropzone
									campaignSlug={campaignSlug}
									onUploadSuccess={(res) => onImageChange(res.url)}
								/>
							)}
						</div>
					</div>
					<div className="SceneCard__grid">{children}</div>
				</div>
			)}

			<ImageGallery
				isOpen={isGalleryOpen}
				onClose={() => setIsGalleryOpen(false)}
				onSelect={(img) => {
					onImageChange(img.url);
					setIsGalleryOpen(false);
				}}
				initialSource={campaignSlug}
				initialCategory="scenes"
			/>
		</div>
	);
}
