import type { Dispatch, SetStateAction } from "react";

import { lang } from "../../../shared/lib/index.js";
import {
	Button,
	Checkbox,
	CollapseToggleButton,
} from "../../../shared/ui/index.js";
import { Modal } from "../../modal/index.js";
import type { ContextListConfig } from "../model/contextConfig.ts";
import type {
	AiContextDataConfig,
	AiContextEntity,
	AiContextSession,
} from "../model/useAiContextData.ts";
import {
	getAiSceneContextConfig,
	getAiSessionContextConfig,
} from "./presentationModel.ts";

type CampaignContextKey =
	| "campaignCharacters"
	| "campaignNpcs"
	| "campaignLocations";

type SceneContextField =
	| "summary"
	| "goal"
	| "stakes"
	| "location"
	| "notes"
	| "encounter";

const SCENE_FIELDS: ReadonlyArray<{
	key: SceneContextField;
	label: string;
}> = [
	{ key: "summary", label: "Scene summary" },
	{ key: "goal", label: "Players' goal" },
	{ key: "stakes", label: "Stakes" },
	{ key: "location", label: "Location" },
	{ key: "notes", label: "Scene notes" },
	{ key: "encounter", label: "Encounter (monsters)" },
];

interface CampaignEntityContextProps {
	context: ContextListConfig;
	contextItems: Record<string, boolean>;
	contextKey: CampaignContextKey;
	emptyLabel: string;
	getDisplayName: (item: AiContextEntity) => string;
	getKey: (item: AiContextEntity) => string;
	label: string;
	list: AiContextEntity[];
	onSetAll: (
		contextKey: CampaignContextKey,
		list: AiContextEntity[],
		getKey: (item: AiContextEntity) => string,
		checked: boolean,
	) => void;
	onToggleIncluded: (
		contextKey: CampaignContextKey,
		included: boolean,
	) => void;
	onToggleItem: (
		contextKey: CampaignContextKey,
		itemKey: string,
		value: boolean,
	) => void;
}

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
}: CampaignEntityContextProps) {
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

export interface AiContextSettingsModalProps {
	characterContext: ContextListConfig;
	characterContextItems: Record<string, boolean>;
	charactersList: AiContextEntity[];
	contextConfig: AiContextDataConfig;
	expandedSessions: Record<string, boolean>;
	getCharacterContextKey: (entity: AiContextEntity) => string;
	getCharacterDisplayName: (entity: AiContextEntity) => string;
	getLocationContextKey: (entity: AiContextEntity) => string;
	getLocationDisplayName: (entity: AiContextEntity) => string;
	isOpen: boolean;
	locationContext: ContextListConfig;
	locationContextItems: Record<string, boolean>;
	locationsList: AiContextEntity[];
	npcContext: ContextListConfig;
	npcContextItems: Record<string, boolean>;
	npcsList: AiContextEntity[];
	onCancel: () => void;
	setAllCampaignContextItems: CampaignEntityContextProps["onSetAll"];
	setContextConfig: Dispatch<SetStateAction<AiContextDataConfig>>;
	sessionsList: AiContextSession[];
	toggleSessionDetails: (sessionSlug: string) => void;
	updateCampaignContextListIncluded: CampaignEntityContextProps["onToggleIncluded"];
	updateCampaignContextListItem: CampaignEntityContextProps["onToggleItem"];
	updateContextConfig: (path: string[], value: boolean) => void;
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
}: AiContextSettingsModalProps) {
	if (!isOpen) return null;

	return (
		<Modal
			title={lang.t("Context settings")}
			onConfirm={() => {}}
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
								setContextConfig((current) => ({
									...current,
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
						const config = getAiSessionContextConfig(contextConfig, slug);
						const isExpanded = Boolean(expandedSessions[slug]);

						return (
							<div key={slug} className="AiAssistant__session_context">
								<div className="AiAssistant__context_row">
									<Checkbox
										checked={config.included}
										onChange={(included) =>
											setContextConfig((current) => ({
												...current,
												sessions: {
													...current.sessions,
													[slug]: { ...config, included },
												},
											}))
										}
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
												checked={config.notes !== false}
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
												checked={config.result_text !== false}
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
												const sceneConfig = getAiSceneContextConfig(
													config,
													scene.id,
												);
												return (
													<div
														key={scene.id}
														className="AiAssistant__scene_item"
													>
														<div className="AiAssistant__context_row">
															<Checkbox
																checked={sceneConfig.included}
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
														{sceneConfig.included && (
															<div className="AiAssistant__scene_fields">
																{SCENE_FIELDS.map((field) => (
																	<Checkbox
																		key={field.key}
																		checked={sceneConfig[field.key]}
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
