import Panel from "./common/Panel";
import Button from "./form/Button";
import Modal from "./common/Modal";
import Bestiary from "./Bestiary";
import AiAssistantPanel from "./AiAssistantPanel";
import MonsterStatBlock from "./MonsterStatBlock";
import Notification from "./common/Notification";
import DraggableList from "./common/DraggableList";
import useEncounterView from "../hooks/useEncounterView";
import Tooltip from "./common/Tooltip";
import classNames from "../utils/classNames";
import "../assets/components/EncounterView.css";
import { lang } from "../services/localization";

function EncounterView(props) {
	const campaign = props.campaign;
	const sessionId = props.sessionId;
	const encounterId = props.encounterId;
	const view = useEncounterView({
		campaign,
		sessionId,
		encounterId,
	});

	if (!view.encounter) {
		return (
			<Panel className="EncounterView">
				<div className="Panel__body">{lang.t("Loading...")}</div>
			</Panel>
		);
	}

	return (
		<Panel className="EncounterView">
			<div className="Panel__header">
				<div className="EncounterView__header">
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						onClick={view.handleBack}
						icon="back"
						className="SessionView__backBtn"
					/>
					<Tooltip content={lang.t("Click to rename")}>
						<h2 className="editable-title" onClick={view.handleRename}>
							{view.encounter.name}
						</h2>
					</Tooltip>
					<p className="muted">
						{lang.t("Combat encounter")} •{" "}
						{lang.t("{count} monsters", {
							count: view.encounter.monsters.length,
						})}
						{view.encounter.monsters.length > 0 &&
							` • ${lang.t("Avg initiative")}: ${view.averageInitiative}`}
					</p>
				</div>
				<div className="EncounterView__headerActions">
					<input
						type="file"
						ref={view.fileInputRef}
						style={{ display: "none" }}
						accept=".json"
						onChange={view.handleFileChange}
					/>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="import"
						onClick={() => view.fileInputRef.current?.click()}
						title={lang.t("Import encounter")}
					/>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="export"
						onClick={view.handleExport}
						title={lang.t("Export encounter")}
					/>
				</div>
			</div>
			<div className="Panel__body EncounterView__body">
				<div className="EncounterView__main">
					<div className="EncounterView__list">
						<Button
							variant="create"
							onClick={() => view.setShowBestiary(true)}
							icon="plus"
							className="EncounterView__addBtn"
						>
							{lang.t("Add monster")}
						</Button>

						<DraggableList
							items={view.encounter.monsters}
							onReorder={view.handleReorderMonsters}
							onDrop={view.handleMonstersDrop}
							keyExtractor={(m) => m.instanceId}
							renderItem={(m, isDragging) => (
								<div
									className={classNames("EncounterMonsterRow", {
										"is-active":
											view.selectedInstance?.instanceId === m.instanceId,
										"is-dragging": isDragging,
									})}
									onClick={() => view.setSelectedInstance(m)}
								>
									<div className="EncounterMonsterRow__content">
										<Tooltip content={lang.t("Click to rename")}>
											<div
												className="EncounterMonsterRow__name editable-title"
												onClick={(e) => {
													e.stopPropagation();
													view.handleRenameMonster(m.instanceId, m.name);
												}}
											>
												{m.name}
											</div>
										</Tooltip>
										<div className="EncounterMonsterRow__stats">
											<div className="EncounterMonsterRow__hp">
												<input
													type="number"
													value={m.currentHp}
													onChange={(e) =>
														view.updateMonsterHp(m.instanceId, e.target.value)
													}
													onClick={(e) => e.stopPropagation()}
													className="EncounterMonsterRow__hpInput"
													style={{
														color: view.getHpColor(m.currentHp, m.hit_points),
													}}
												/>
												<span className="muted">/</span>
												<Tooltip content={lang.t("Max HP")}>
													<input
														type="number"
														value={m.hit_points}
														onChange={(e) =>
															view.updateMonsterMaxHp(
																m.instanceId,
																e.target.value,
															)
														}
														onClick={(e) => e.stopPropagation()}
														className="EncounterMonsterRow__maxHpInput"
													/>
												</Tooltip>
											</div>
											<div className="EncounterMonsterRow__ac">
												{lang.t("AC")} {m.armor_class}
											</div>
										</div>
									</div>
									<div className="EncounterMonsterRow__actions">
										<Button
											variant="ghost"
											size={Button.SIZES.SMALL}
											icon="dice"
											className="EncounterMonsterRow__action"
											onClick={(e) => {
												e.stopPropagation();
												view.rollMonsterHp(m.instanceId);
											}}
											title={lang.t("Roll HP by formula")}
										/>
										<Button
											variant="ghost"
											size={Button.SIZES.SMALL}
											icon="plus"
											className="EncounterMonsterRow__action"
											onClick={(e) => {
												e.stopPropagation();
												view.duplicateMonster(m);
											}}
											title={lang.t("Duplicate")}
										/>
										<Button
											variant="danger"
											size={Button.SIZES.SMALL}
											icon="x"
											className="EncounterMonsterRow__action"
											onClick={(e) => {
												e.stopPropagation();
												view.removeMonster(m.instanceId);
											}}
											title={lang.t("Delete")}
										/>
									</div>
								</div>
							)}
						/>
					</div>

					<div className="EncounterView__detailView">
						{view.selectedInstance ? (
							<MonsterStatBlock
								monster={view.selectedInstance}
								tokenImageOverrideUrl={view.getMonsterImageOverride(
									view.selectedInstance,
								)}
							/>
						) : (
							<p className="muted">
								{lang.t("Select a monster from the list to see its stats.")}
							</p>
						)}
					</div>
				</div>
				<AiAssistantPanel
					sessionData={view.encounter}
					onInsertResult={view.handleAiUpdate}
				/>
			</div>

			{view.showBestiary && (
				<Modal
					title={lang.t("Choose monster")}
					onCancel={() => view.setShowBestiary(false)}
					showFooter={false}
					type="custom"
				>
					<Bestiary onAddMonster={view.handleAddMonster} isEmbedded={true} />
				</Modal>
			)}

			{view.notification && (
				<Notification
					message={view.notification}
					onClose={() => view.setNotification(null)}
				/>
			)}
		</Panel>
	);
}

export { EncounterView };
export default EncounterView;
