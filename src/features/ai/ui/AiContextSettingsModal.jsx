import { Button } from "../../../shared/ui/index.js";
import { Checkbox } from "../../../shared/ui/index.js";
import { CollapseToggleButton } from "../../../shared/ui/index.js";
import { Modal } from "../../modal/index.js";
import { lang } from "../../../shared/lib/index.js";

const SCENE_FIELDS = [
	{ key: "summary", label: "Scene summary" },
	{ key: "goal", label: "Players' goal" },
	{ key: "stakes", label: "Stakes" },
	{ key: "location", label: "Location" },
	{ key: "notes", label: "Scene notes" },
	{ key: "encounter", label: "Encounter (monsters)" },
];

function CampaignEntityContext({
	context,
	contextItems,
	contextKey,
	emptyLabel,
	getDisplayName,
	getKey,
	label,
	list,
	onSetAll,
	onToggleIncluded,
	onToggleItem,
}) {
	return (
		<>
			<div className="AiAssistant__context_row">
				<Checkbox
					checked={context.included !== false}
					onChange={(included) => onToggleIncluded(contextKey, included)}
					label={lang.t(label)}
				/>
			</div>
			{context.included !== false && (
				<div className="AiAssistant__location_context">
					<div className="AiAssistant__location_actions">
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							onClick={() => onSetAll(contextKey, list, getKey, true)}
							disabled={list.length === 0}
						>
							{lang.t("All")}
						</Button>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							onClick={() => onSetAll(contextKey, list, getKey, false)}
							disabled={list.length === 0}
						>
							{lang.t("Clear")}
						</Button>
					</div>
					{list.length > 0 ? (
						list.map((item) => {
							const itemKey = getKey(item);
							if (!itemKey) return null;
							return (
								<div
									key={itemKey}
									className="AiAssistant__context_row AiAssistant__location_row"
								>
									<Checkbox
										checked={contextItems[itemKey] !== false}
										onChange={(value) =>
											onToggleItem(contextKey, itemKey, value)
										}
										label={getDisplayName(item)}
									/>
								</div>
							);
						})
					) : (
						<div className="muted AiAssistant__empty_context">
							{lang.t(emptyLabel)}
						</div>
					)}
				</div>
			)}
		</>
	);
}

export default function AiContextSettingsModal({
	characterContext,
	characterContextItems,
	charactersList,
	contextConfig,
	expandedSessions,
	getCharacterContextKey,
	getCharacterDisplayName,
	getLocationContextKey,
	getLocationDisplayName,
	isOpen,
	locationContext,
	locationContextItems,
	locationsList,
	npcContext,
	npcContextItems,
	npcsList,
	onCancel,
	setAllCampaignContextItems,
	setContextConfig,
	sessionsList,
	toggleSessionDetails,
	updateCampaignContextListIncluded,
	updateCampaignContextListItem,
	updateContextConfig,
}) {
	if (!isOpen) return null;

	return (
		<Modal
			title={lang.t("Context settings")}
			onCancel={onCancel}
			showFooter={false}
		>
			<div className="AiAssistant__context_manager">
				<section>
					<h4>{lang.t("Campaign")}</h4>
					<div className="AiAssistant__context_row">
						<Checkbox
							checked={contextConfig.campaignNotes}
							onChange={(value) =>
								setContextConfig((prev) => ({
									...prev,
									campaignNotes: value,
								}))
							}
							label={lang.t("Campaign notes")}
						/>
					</div>
					<CampaignEntityContext
						contextKey="campaignCharacters"
						context={characterContext}
						contextItems={characterContextItems}
						emptyLabel="No characters yet."
						getDisplayName={getCharacterDisplayName}
						getKey={getCharacterContextKey}
						label="Characters"
						list={charactersList}
						onSetAll={setAllCampaignContextItems}
						onToggleIncluded={updateCampaignContextListIncluded}
						onToggleItem={updateCampaignContextListItem}
					/>
					<CampaignEntityContext
						contextKey="campaignNpcs"
						context={npcContext}
						contextItems={npcContextItems}
						emptyLabel="No NPCs yet."
						getDisplayName={getCharacterDisplayName}
						getKey={getCharacterContextKey}
						label="NPCs"
						list={npcsList}
						onSetAll={setAllCampaignContextItems}
						onToggleIncluded={updateCampaignContextListIncluded}
						onToggleItem={updateCampaignContextListItem}
					/>
					<CampaignEntityContext
						contextKey="campaignLocations"
						context={locationContext}
						contextItems={locationContextItems}
						emptyLabel="No locations/factions yet."
						getDisplayName={getLocationDisplayName}
						getKey={getLocationContextKey}
						label="Locations/Factions"
						list={locationsList}
						onSetAll={setAllCampaignContextItems}
						onToggleIncluded={updateCampaignContextListIncluded}
						onToggleItem={updateCampaignContextListItem}
					/>
				</section>

				<section>
					<h4>{lang.t("Sessions")}</h4>
					{sessionsList.map((session) => {
						const slug = session.fileName;
						const config = contextConfig.sessions[slug] || {
							included: false,
							notes: true,
							result_text: true,
							scenes: {},
						};
						const isExpanded = !!expandedSessions[slug];

						return (
							<div key={slug} className="AiAssistant__session_context">
								<div className="AiAssistant__context_row">
									<Checkbox
										checked={config.included}
										onChange={(included) => {
											setContextConfig((prev) => ({
												...prev,
												sessions: {
													...prev.sessions,
													[slug]: { ...config, included },
												},
											}));
										}}
										label={session.name}
										className="AiAssistant__session_name"
									/>
									<CollapseToggleButton
										size={Button.SIZES.SMALL}
										rotated={isExpanded}
										onClick={() => toggleSessionDetails(slug)}
									/>
								</div>
								{isExpanded && config.data && (
									<div className="AiAssistant__context_details">
										<div className="AiAssistant__context_row">
											<Checkbox
												checked={config.notes}
												onChange={(value) =>
													updateContextConfig(
														["sessions", slug, "notes"],
														value,
													)
												}
												label={lang.t("Notes")}
											/>
										</div>
										<div className="AiAssistant__context_row">
											<Checkbox
												checked={config.result_text}
												onChange={(value) =>
													updateContextConfig(
														["sessions", slug, "result_text"],
														value,
													)
												}
												label={lang.t("Summary")}
											/>
										</div>
										<div className="AiAssistant__scenes_context">
											{(config.data.scenes || []).map((scene, index) => {
												const sceneConf = config.scenes[scene.id] || {
													included: true,
													summary: true,
													goal: true,
													stakes: true,
													location: true,
													notes: true,
													encounter: true,
												};
												return (
													<div
														key={scene.id}
														className="AiAssistant__scene_item"
													>
														<div className="AiAssistant__context_row">
															<Checkbox
																checked={sceneConf.included}
																onChange={(value) =>
																	updateContextConfig(
																		[
																			"sessions",
																			slug,
																			"scenes",
																			scene.id,
																			"included",
																		],
																		value,
																	)
																}
																label={lang.t("Scene {number}", {
																	number: index + 1,
																})}
															/>
														</div>
														{sceneConf.included && (
															<div className="AiAssistant__scene_fields">
																{SCENE_FIELDS.map((field) => (
																	<Checkbox
																		key={field.key}
																		checked={sceneConf[field.key]}
																		onChange={(value) =>
																			updateContextConfig(
																				[
																					"sessions",
																					slug,
																					"scenes",
																					scene.id,
																					field.key,
																				],
																				value,
																			)
																		}
																		label={lang.t(field.label)}
																	/>
																))}
															</div>
														)}
													</div>
												);
											})}
										</div>
									</div>
								)}
							</div>
						);
					})}
				</section>
			</div>
		</Modal>
	);
}
