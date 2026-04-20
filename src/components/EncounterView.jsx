import Panel from "./Panel";
import Button from "./Button";
import Modal from "./Modal";
import Bestiary from "./Bestiary";
import AiAssistantPanel from "./AiAssistantPanel";
import MonsterStatBlock from "./MonsterStatBlock";
import Notification from "./Notification";
import DraggableList from "./DraggableList";
import withEncounterView from "../hoc/withEncounterView";
import "../assets/components/EncounterView.css";

function EncounterView({
	onBack,
	modal,
	encounter,
	selectedInstance,
	setSelectedInstance,
	showBestiary,
	setShowBestiary,
	notification,
	setNotification,
	fileInputRef,
	averageInitiative,
	handleFileChange,
	handleExport,
	handleRename,
	handleAddMonster,
	handleAiUpdate,
	removeMonster,
	updateMonsterHp,
	updateMonsterMaxHp,
	handleRenameMonster,
	duplicateMonster,
	getHpColor,
	handleReorderMonsters,
	handleMonstersDrop,
}) {
	if (!encounter) {
		return (
			<Panel className="EncounterView">
				<div className="Panel__body">Завантаження...</div>
			</Panel>
		);
	}

	return (
		<Panel className="EncounterView">
			<div className="Panel__header">
				<div className="EncounterView__header">
					<Button
						variant="ghost"
						size="small"
						onClick={onBack}
						icon="back"
						className="SessionView__backBtn"
					/>
					<h2
						className="editable-title"
						onClick={handleRename}
						title="Натисніть, щоб перейменувати">
						{encounter.name}
					</h2>
					<p className="muted">
						Бойове зіткнення • {encounter.monsters.length} монстрів
						{encounter.monsters.length > 0 &&
							` • Сер. ініціатива: ${averageInitiative}`}
					</p>
				</div>
				<div className="EncounterView__headerActions">
					<input
						type="file"
						ref={fileInputRef}
						style={{ display: "none" }}
						accept=".json"
						onChange={handleFileChange}
					/>
					<Button
						variant="ghost"
						size="small"
						icon="import"
						onClick={() => fileInputRef.current?.click()}
						title="Імпортувати бій"
					/>
					<Button
						variant="ghost"
						size="small"
						icon="export"
						onClick={handleExport}
						title="Експортувати бій"
					/>
				</div>
			</div>
			<div className="Panel__body EncounterView__body">
				<div className="EncounterView__main">
					<div className="EncounterView__list">
						<Button
							variant="create"
							onClick={() => setShowBestiary(true)}
							icon="plus"
							className="EncounterView__addBtn">
							Додати монстра
						</Button>

						<DraggableList
							items={encounter.monsters}
							onReorder={handleReorderMonsters}
							onDrop={handleMonstersDrop}
							keyExtractor={(m) => m.instanceId}
							renderItem={(m, isDragging) => (
								<div
									className={`EncounterMonsterRow ${selectedInstance?.instanceId === m.instanceId ? "is-active" : ""} ${isDragging ? "is-dragging" : ""}`}
									onClick={() => setSelectedInstance(m)}>
									<div className="EncounterMonsterRow__content">
										<div
											className="EncounterMonsterRow__name editable-title"
											onClick={(e) => {
												e.stopPropagation();
												handleRenameMonster(m.instanceId, m.name);
											}}
											title="Натисніть, щоб змінити ім'я">
											{m.name}
										</div>
										<div className="EncounterMonsterRow__stats">
											<div className="EncounterMonsterRow__hp">
												<input
													type="number"
													value={m.currentHp}
													onChange={(e) =>
														updateMonsterHp(m.instanceId, e.target.value)
													}
													onClick={(e) => e.stopPropagation()}
													className="EncounterMonsterRow__hpInput"
													style={{
														color: getHpColor(m.currentHp, m.hit_points),
													}}
												/>
												<span className="muted">/</span>
												<input
													type="number"
													value={m.hit_points}
													onChange={(e) =>
														updateMonsterMaxHp(m.instanceId, e.target.value)
													}
													onClick={(e) => e.stopPropagation()}
													className="EncounterMonsterRow__maxHpInput"
													title="Максимальне HP"
												/>
											</div>
											<div className="EncounterMonsterRow__ac">
												AC {m.armor_class}
											</div>
										</div>
									</div>
									<div className="EncounterMonsterRow__actions">
										<Button
											variant="ghost"
											size="small"
											icon="plus"
											className="EncounterMonsterRow__action"
											onClick={(e) => {
												e.stopPropagation();
												duplicateMonster(m);
											}}
											title="Дублювати"
										/>
										<Button
											variant="danger"
											size="small"
											icon="x"
											className="EncounterMonsterRow__action"
											onClick={(e) => {
												e.stopPropagation();
												removeMonster(m.instanceId);
											}}
											title="Видалити"
										/>
									</div>
								</div>
							)}
						/>
					</div>

					<div className="EncounterView__detailView">
						{selectedInstance ? (
							<MonsterStatBlock monster={selectedInstance} modal={modal} />
						) : (
							<p className="muted">
								Оберіть монстра зі списку, щоб побачити його характеристики.
							</p>
						)}
					</div>
				</div>
				<AiAssistantPanel
					sessionData={encounter}
					onInsertResult={handleAiUpdate}
					modal={modal}
				/>
			</div>

			{showBestiary && (
				<Modal
					title="Вибір монстра"
					onCancel={() => setShowBestiary(false)}
					showFooter={false}
					type="custom">
					<Bestiary onAddMonster={handleAddMonster} isEmbedded={true} modal={modal} />
				</Modal>
			)}

			{notification && (
				<Notification message={notification} onClose={() => setNotification(null)} />
			)}
		</Panel>
	);
}

export { EncounterView };
const EncounterViewWithHOC = withEncounterView(EncounterView);
export default EncounterViewWithHOC;

