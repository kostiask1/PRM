import { useState } from "react";
import type {
	ScopedSettingsStorageSummary,
	SettingsCampaign,
	SettingsStorageAction,
	SettingsStorageSegmentId,
} from "../model/settingsModal.ts";
import type { Theme } from "../model/theme.ts";
import {
	DEFAULT_IMAGE_PROMPT_BASE_PROMPT,
	GLOBAL_SETTINGS_SCOPE,
	type SettingsSaveStatus,
} from "../model/settingsModal.ts";
import { THEMES } from "../model/theme.ts";
import { formatBytes, lang } from "../../../shared/lib/index.js";
import { formatSourceLabel } from "../../../entities/reference/index.js";
import {
	Button,
	MultiSelect,
	Notification,
	Select,
	Switch,
} from "../../../shared/ui/index.js";
import ColorThemeSwitcher from "./ColorThemeSwitcher.tsx";
import type { SettingsModalCompositionSlots } from "./settingsModalComposition.ts";

export interface SettingsGeneralViewProps {
	currentTheme: Theme;
	currentLanguage: string;
	availableLanguages: string[];
	autoApplyAiChanges: boolean;
	useSearchDebounce: boolean;
	showAllCardNotes: boolean;
	animationMode: "auto" | "enabled" | "disabled";
	onAnimationModeChange: (mode: "auto" | "enabled" | "disabled") => void;
	onCardNotesChange: (enabled: boolean) => void;
	onThemeToggle: () => void;
	onLanguageChange: (language: string) => void;
	onAutoApplyAiChangesChange: (enabled: boolean) => void;
	onUseSearchDebounceChange: (enabled: boolean) => void;
}

export interface SettingsScopeViewProps {
	campaigns: SettingsCampaign[];
	selectedScope: string;
	onScopeChange: (scope: string) => void;
}

export interface SettingsNotesViewProps {
	isInherited: boolean;
	status: SettingsSaveStatus;
	simplifiedNotesEnabled: boolean;
	onSimplifiedNotesChange: (enabled: boolean) => void;
}

export interface SettingsSourcesViewProps {
	isGlobalScope: boolean;
	isInherited: boolean;
	status: SettingsSaveStatus;
	options: string[];
	selectedSources: string[];
	onSelectedSourcesChange: (sources: string[]) => void;
	onUseGlobal: () => void;
}

export interface SettingsAiViewProps {
	isGlobalScope: boolean;
	status: SettingsSaveStatus;
	basePrompt: string;
	imagePrompt: string;
	onBasePromptChange: (value: string) => void;
	onImagePromptChange: (value: string) => void;
}

export interface SettingsStorageViewProps {
	isLoading: boolean;
	error: string | null;
	summary: ScopedSettingsStorageSummary | null;
	clearingAction: SettingsStorageAction | null;
	pendingConfirmAction: SettingsStorageAction | null;
	onRefresh: () => void;
	onRequestConfirm: (action: SettingsStorageAction) => void;
	onCancelConfirm: () => void;
	onConfirmAction: (action: SettingsStorageAction) => void;
}

export interface SettingsModalViewProps {
	notification: string | null;
	general: SettingsGeneralViewProps;
	scope: SettingsScopeViewProps;
	notes: SettingsNotesViewProps;
	sources: SettingsSourcesViewProps;
	ai: SettingsAiViewProps;
	storage: SettingsStorageViewProps;
	onNotificationClose: () => void;
	onCancel?: () => void;
}

type SettingsAiGroupProps = SettingsAiViewProps & SettingsModalCompositionSlots;
type SettingsSection = "general" | "campaign" | "ai" | "storage";

function SettingsGeneralGroup({
	currentTheme,
	currentLanguage,
	availableLanguages,
	autoApplyAiChanges,
	useSearchDebounce,
	showAllCardNotes,
	animationMode,
	onAnimationModeChange,
	onCardNotesChange,
	onThemeToggle,
	onLanguageChange,
	onAutoApplyAiChangesChange,
	onUseSearchDebounceChange,
}: SettingsGeneralViewProps) {
	return (
		<div className="SettingsModal__group">
			<div className="SettingsModal__sectionHeader">
				<h3>{lang.t("General settings")}</h3>
			</div>
			<div className="SettingsModal__themeRow">
				<div className="SettingsModal__themeInfo">
					<div className="SettingsModal__label">{lang.t("Theme")}</div>
					<div className="SettingsModal__hint">
						{currentTheme === THEMES.DARK
							? lang.t("Switch to light theme")
							: lang.t("Switch to dark theme")}
					</div>
				</div>
				<ColorThemeSwitcher theme={currentTheme} onToggle={onThemeToggle} />
			</div>

			<div className="SettingsModal__lang">
				<label className="SettingsModal__label">{lang.t("Language")}</label>
				<Select
					aria-label={lang.t("Language")}
					value={currentLanguage}
					onChange={(event) => onLanguageChange(event.target.value)}
				>
					{availableLanguages.map((languageCode) => (
						<option key={languageCode} value={languageCode}>
							{languageCode === "uk"
								? lang.t("Ukrainian")
								: languageCode === "en"
									? lang.t("English")
									: languageCode.toUpperCase()}
						</option>
					))}
				</Select>
			</div>

			<div className="SettingsModal__lang">
				<label className="SettingsModal__label">{lang.t("Interface animations")}</label>
				<Select
					aria-label={lang.t("Interface animations")}
					value={animationMode}
					onChange={(event) =>
						onAnimationModeChange(
							event.target.value as "auto" | "enabled" | "disabled",
						)
					}
				>
					<option value="auto">
						{lang.t("Automatic (adapts to power saving and OS)")}
					</option>
					<option value="enabled">{lang.t("Always enabled")}</option>
					<option value="disabled">
						{lang.t("Disabled (power saving)")}
					</option>
				</Select>
			</div>

			<Switch checked={showAllCardNotes} onChange={onCardNotesChange} label={lang.t("Show all notes in cards and scenes")} />
			<Switch
				checked={useSearchDebounce}
				onChange={onUseSearchDebounceChange}
				label={lang.t("Use search debounce")}
				description={lang.t(
					"When disabled, search results update immediately while typing.",
				)}
			/>
			<Switch
				checked={autoApplyAiChanges}
				onChange={onAutoApplyAiChangesChange}
				label={lang.t("Apply parsed AI changes automatically")}
				description={lang.t(
					"When disabled, parsed AI responses are saved as drafts for review before applying.",
				)}
			/>
		</div>
	);
}

function SettingsSourcesGroup({
	isGlobalScope,
	isInherited,
	status,
	options,
	selectedSources,
	onSelectedSourcesChange,
	onUseGlobal,
}: SettingsSourcesViewProps) {
	return (
		<div className="SettingsModal__group SettingsModal__subsection">
			<div className="SettingsModal__sectionHeader">
				<div>
					<div className="SettingsModal__label">
						{lang.t("Content sources")}
					</div>
					<div className="SettingsModal__hint">
						{lang.t(
							"Unchecked sources are hidden in Bestiary, Spells, and official tokens.",
						)}
					</div>
					{!isGlobalScope && (
						<>
							<div className="SettingsModal__hint">
								{lang.t(isInherited ? "This campaign follows the global source selection." : "This campaign has its own source selection.")}
							</div>
							<div className="SettingsModal__hint">
								{lang.t("Copying global sources creates a campaign selection; later global changes will not update it.")}
							</div>
						</>
					)}
				</div>
				{status === "saving" && (
					<span className="SettingsModal__saveStatus" role="status">
						{lang.t("Saving...")}
					</span>
				)}
			</div>

			<div className="SettingsModal__field">
				<span className="SettingsModal__label">{lang.t("Visible sources")}</span>
				<div className="SettingsModal__sourceRow">
					<MultiSelect
						className="SettingsModal__sourceSelect"
						ariaLabel={lang.t("Visible sources")}
						value={selectedSources}
						onChange={onSelectedSourcesChange}
						optionClickMode="toggle"
						placeholder={lang.t("Sources")}
						allSelectedLabel={lang.t("All sources")}
						noneSelectedLabel={lang.t("No sources")}
						selectAllLabel={lang.t("Select all")}
						clearLabel={lang.t("Clear")}
						dropdownMinWidth={520}
						options={options.map((source) => ({
							value: source,
							label:
								source === "CUSTOM"
									? lang.t("Custom creatures")
									: formatSourceLabel(source),
						}))}
					/>
					{!isGlobalScope && (
						<div className="SettingsModal__inlineActions">
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								onClick={onUseGlobal}
							>
								{lang.t("Copy global sources")}
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function SettingsAiGroup({
	isGlobalScope,
	status,
	basePrompt,
	imagePrompt,
	onBasePromptChange,
	onImagePromptChange,
	EditableField,
}: SettingsAiGroupProps) {
	return (
		<div className="SettingsModal__group SettingsModal__subsection SettingsModal__section_ai">
			{status === "saving" && (
					<span className="SettingsModal__saveStatus" role="status">
						{lang.t("Saving...")}
					</span>
			)}
			<div className="SettingsModal__promptGrid">
				<label className="SettingsModal__field">
					<span className="SettingsModal__label">{lang.t("AI base prompt")}</span>
					<div className="SettingsModal__hint">
						{isGlobalScope
							? lang.t("These instructions are added to every future AI request.")
							: lang.t("Added alongside the global AI prompt for this campaign. Leave empty to use only the global prompt.")}
					</div>
					<EditableField
						type="textarea"
						aria-label={lang.t("AI base prompt")}
						className="SettingsModal__promptField"
						value={basePrompt}
						onChange={(event) => onBasePromptChange(event.target.value)}
						placeholder={
							isGlobalScope
								? lang.t(
										"Example: Keep answers concise, prefer dark fantasy tone, avoid comic relief...",
									)
								: lang.t(
										"Example: This campaign is grounded, political, and low magic...",
									)
						}
						disabled={false}
					/>
				</label>

				<label className="SettingsModal__field">
					<span className="SettingsModal__label">
						{lang.t("Image prompt base style")}
					</span>
					<div className="SettingsModal__hint">
						{isGlobalScope
							? lang.t(
									"These style instructions are added to every image prompt generation request.",
								)
							: imagePrompt
								? lang.t("This campaign uses its own image style instead of the global style.")
								: lang.t("This campaign uses the global image style until you enter one here.")}
					</div>
					<EditableField
						type="textarea"
						aria-label={lang.t("Image prompt base style")}
						className="SettingsModal__promptField"
						value={imagePrompt}
						onChange={(event) => onImagePromptChange(event.target.value)}
						placeholder={
							isGlobalScope
								? DEFAULT_IMAGE_PROMPT_BASE_PROMPT
								: lang.t(
										"Example: gothic oil painting, muted colors, candlelight, worn parchment textures...",
									)
						}
						disabled={false}
					/>
				</label>
			</div>
		</div>
	);
}

function getSegmentLabel(
	segmentId: SettingsStorageSegmentId,
	isGlobalScope: boolean,
): string {
	switch (segmentId) {
		case "images":
			return lang.t(isGlobalScope ? "Images" : "Campaign images");
		case "content":
			return lang.t(
				isGlobalScope ? "Campaign content" : "Selected campaign content",
			);
		case "ai":
			return lang.t("AI history");
		case "undoRedo":
			return lang.t("Undo/Redo history");
		case "appData":
			return lang.t("Bestiary, favorites & settings");
	}
}

function getStorageConfirmMessage(
	action: SettingsStorageAction,
	summary: ScopedSettingsStorageSummary,
): string {
	switch (action) {
		case "ai-all":
			return lang.t(
				"Clear AI history across all campaigns and the Bestiary ({size})? This cannot be undone.",
				{ size: formatBytes(summary.aiHistory.bytes) },
			);
		case "ai-bestiary":
			return lang.t(
				"Clear Bestiary AI history ({size})? This cannot be undone.",
				{ size: formatBytes(summary.aiHistory.bestiaryBytes) },
			);
		case "ai-campaign":
			return lang.t(
				'Clear AI history for "{name}" ({size})? This cannot be undone.',
				{
					name: summary.campaignName || summary.campaignSlug || "",
					size: formatBytes(summary.aiHistory.bytes),
				},
			);
		case "undo-all":
			return lang.t(
				"Clear all Undo/Redo history and recovery snapshots across the project ({size})? This cannot be undone.",
				{ size: formatBytes(summary.undoRedo.bytes) },
			);
		case "undo-application":
			return lang.t(
				"Clear application-level Undo/Redo history and lifecycle recovery snapshots ({size})? Campaign edit histories will stay intact.",
				{ size: formatBytes(summary.undoRedo.applicationBytes) },
			);
		case "undo-campaign":
			return lang.t(
				'Clear Undo/Redo history for "{name}" ({size})? This cannot be undone.',
				{
					name: summary.campaignName || summary.campaignSlug || "",
					size: formatBytes(summary.undoRedo.bytes),
				},
			);
	}
}

function SettingsStorageGroup({
	isLoading,
	error,
	summary,
	clearingAction,
	pendingConfirmAction,
	onRefresh,
	onRequestConfirm,
	onCancelConfirm,
	onConfirmAction,
}: SettingsStorageViewProps) {
	const isBusy = Boolean(clearingAction);
	const isAiConfirmOpen =
		pendingConfirmAction === "ai-all" ||
		pendingConfirmAction === "ai-bestiary" ||
		pendingConfirmAction === "ai-campaign";
	const isUndoConfirmOpen =
		pendingConfirmAction === "undo-all" ||
		pendingConfirmAction === "undo-application" ||
		pendingConfirmAction === "undo-campaign";

	if (isLoading && !summary) {
		return (
			<div className="SettingsModal__group SettingsModal__subsection">
				<div className="SettingsModal__hint">{lang.t("Loading...")}</div>
			</div>
		);
	}

	if (!summary) {
		return (
			<div className="SettingsModal__group SettingsModal__subsection">
				<div className="SettingsModal__sectionHeader">
					<span className="SettingsModal__hint">
						{error || lang.t("No campaigns")}
					</span>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						onClick={onRefresh}
						disabled={isLoading || isBusy}
					>
						{lang.t("Refresh")}
					</Button>
				</div>
			</div>
		);
	}

	const breakdownRows: Array<{
		id: SettingsStorageSegmentId;
		label: string;
		bytes: number;
		detail?: string;
	}> = summary.isGlobalScope
		? [
				{
					id: "content",
					label: lang.t("Campaign content"),
					bytes: summary.contentBytes,
				},
				{
					id: "images",
					label: lang.t("Images"),
					bytes: summary.imagesBytes,
					detail:
						summary.generalImagesBytes > 0
							? lang.t("Shared gallery: {size}", {
									size: formatBytes(summary.generalImagesBytes),
								})
							: undefined,
				},
				{
					id: "ai",
					label: lang.t("AI history"),
					bytes: summary.aiHistory.bytes,
					detail: `${lang.t("{count} entries", {
						count: summary.aiHistory.entryCount,
					})} · ${lang.t(
						"Campaigns: {campaignsSize} · Bestiary: {bestiarySize}",
						{
							campaignsSize: formatBytes(summary.aiHistory.campaignsBytes),
							bestiarySize: formatBytes(summary.aiHistory.bestiaryBytes),
						},
					)}`,
				},
				{
					id: "undoRedo",
					label: lang.t("Undo/Redo history"),
					bytes: summary.undoRedo.bytes,
					detail: `${lang.t("{count} actions", {
						count: summary.undoRedo.entryCount,
					})} · ${lang.t(
						"Application: {appSize} · Campaigns: {campaignsSize}",
						{
							appSize: formatBytes(summary.undoRedo.applicationBytes),
							campaignsSize: formatBytes(summary.undoRedo.campaignsBytes),
						},
					)}`,
				},
				{
					id: "appData",
					label: lang.t("Bestiary, favorites & settings"),
					bytes: summary.appDataBytes,
				},
			]
		: [
				{
					id: "content",
					label: lang.t("Selected campaign content"),
					bytes: summary.contentBytes,
				},
				{
					id: "images",
					label: lang.t("Campaign images"),
					bytes: summary.imagesBytes,
				},
				{
					id: "ai",
					label: lang.t("AI history"),
					bytes: summary.aiHistory.bytes,
					detail: lang.t("{count} entries", {
						count: summary.aiHistory.entryCount,
					}),
				},
				{
					id: "undoRedo",
					label: lang.t("Undo/Redo history"),
					bytes: summary.undoRedo.bytes,
					detail: lang.t("{count} actions", {
						count: summary.undoRedo.entryCount,
					}),
				},
			];

	const isAiEmpty =
		summary.aiHistory.bytes === 0 && summary.aiHistory.entryCount === 0;
	const isBestiaryAiEmpty =
		summary.aiHistory.bestiaryBytes === 0 &&
		summary.aiHistory.bestiaryEntryCount === 0;
	const isUndoEmpty =
		summary.undoRedo.bytes === 0 && summary.undoRedo.entryCount === 0;
	const isAppUndoEmpty =
		summary.undoRedo.applicationBytes === 0 &&
		summary.undoRedo.applicationEntryCount === 0;

	return (
		<div className="SettingsModal__group SettingsModal__subsection">
			<div className="SettingsModal__storageHeader">
				<div className="SettingsModal__label">
					{lang.t(
						summary.isGlobalScope
							? "Project storage usage"
							: "Campaign storage usage",
					)}
				</div>
				<div className="SettingsModal__storageHeaderRight">
					<span className="SettingsModal__storageTotal">
						{formatBytes(summary.totalBytes)}
					</span>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						onClick={onRefresh}
						disabled={isLoading || isBusy}
					>
						{lang.t("Refresh")}
					</Button>
				</div>
			</div>

			{error && <div className="SettingsModal__hint">{error}</div>}

			{summary.segments.length > 0 && (
				<div className="SettingsModal__storageBar" aria-hidden="true">
					{summary.segments.map((segment) => (
						<div
							key={segment.id}
							className={`SettingsModal__storageSegment SettingsModal__storageSegment--${segment.id}`}
							style={{ width: `${segment.percent}%` }}
							title={`${getSegmentLabel(segment.id, summary.isGlobalScope)}: ${formatBytes(segment.bytes)} (${segment.percent}%)`}
						/>
					))}
				</div>
			)}

			<div className="SettingsModal__storageBreakdown">
				{breakdownRows.map((row) => (
					<div key={row.id} className="SettingsModal__storageRow">
						<div className="SettingsModal__storageRowMain">
							<span
								className={`SettingsModal__storageDot SettingsModal__storageSegment--${row.id}`}
								aria-hidden="true"
							/>
							<div>
								<div className="SettingsModal__storageLabel">{row.label}</div>
								{row.detail && (
									<div className="SettingsModal__hint">{row.detail}</div>
								)}
							</div>
						</div>
						<span className="SettingsModal__storageSize">
							{formatBytes(row.bytes)}
						</span>
					</div>
				))}
			</div>

			<div className="SettingsModal__cleanupGrid">
				<div className="SettingsModal__cleanupCard">
					<div className="SettingsModal__cleanupHeader">
						<span className="SettingsModal__label">
							{lang.t("AI history")}
						</span>
						<span className="SettingsModal__cleanupBadge">
							{formatBytes(summary.aiHistory.bytes)} ·{" "}
							{lang.t("{count} entries", {
								count: summary.aiHistory.entryCount,
							})}
						</span>
					</div>
					<div className="SettingsModal__hint">
						{lang.t(
							"Saved AI responses and draft changes will be removed. Applied campaign and bestiary data stay unchanged.",
						)}
					</div>
					{isAiConfirmOpen && pendingConfirmAction ? (
						<div className="SettingsModal__cleanupConfirm">
							<div className="SettingsModal__cleanupConfirmText">
								{getStorageConfirmMessage(pendingConfirmAction, summary)}
							</div>
							<div className="SettingsModal__cleanupConfirmButtons">
								<Button
									variant="danger"
									size={Button.SIZES.SMALL}
									disabled={isBusy}
									onClick={() => onConfirmAction(pendingConfirmAction)}
								>
									{clearingAction === pendingConfirmAction
										? lang.t("Clearing...")
										: lang.t("Confirm")}
								</Button>
								<Button
									variant="ghost"
									size={Button.SIZES.SMALL}
									disabled={isBusy}
									onClick={onCancelConfirm}
								>
									{lang.t("Cancel")}
								</Button>
							</div>
						</div>
					) : (
						<div className="SettingsModal__cleanupActions">
							{summary.isGlobalScope ? (
								<>
									<Button
										variant="danger"
										size={Button.SIZES.SMALL}
										disabled={isAiEmpty || isBusy}
										onClick={() => onRequestConfirm("ai-all")}
									>
										{lang.t("Clear all AI history")}
									</Button>
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										disabled={isBestiaryAiEmpty || isBusy}
										onClick={() => onRequestConfirm("ai-bestiary")}
									>
										{lang.t("Bestiary only ({size})", {
											size: formatBytes(summary.aiHistory.bestiaryBytes),
										})}
									</Button>
								</>
							) : (
								<Button
									variant="danger"
									size={Button.SIZES.SMALL}
									disabled={isAiEmpty || isBusy}
									onClick={() => onRequestConfirm("ai-campaign")}
								>
									{lang.t("Clear AI history")}
								</Button>
							)}
						</div>
					)}
				</div>

				<div className="SettingsModal__cleanupCard">
					<div className="SettingsModal__cleanupHeader">
						<span className="SettingsModal__label">
							{lang.t("Undo/Redo history")}
						</span>
						<span className="SettingsModal__cleanupBadge">
							{formatBytes(summary.undoRedo.bytes)} ·{" "}
							{lang.t("{count} actions", {
								count: summary.undoRedo.entryCount,
							})}
						</span>
					</div>
					<div className="SettingsModal__hint">
						{lang.t(
							"Saved undo/redo steps and deletion recovery snapshots will be removed. Current data stay unchanged.",
						)}
					</div>
					{isUndoConfirmOpen && pendingConfirmAction ? (
						<div className="SettingsModal__cleanupConfirm">
							<div className="SettingsModal__cleanupConfirmText">
								{getStorageConfirmMessage(pendingConfirmAction, summary)}
							</div>
							<div className="SettingsModal__cleanupConfirmButtons">
								<Button
									variant="danger"
									size={Button.SIZES.SMALL}
									disabled={isBusy}
									onClick={() => onConfirmAction(pendingConfirmAction)}
								>
									{clearingAction === pendingConfirmAction
										? lang.t("Clearing...")
										: lang.t("Confirm")}
								</Button>
								<Button
									variant="ghost"
									size={Button.SIZES.SMALL}
									disabled={isBusy}
									onClick={onCancelConfirm}
								>
									{lang.t("Cancel")}
								</Button>
							</div>
						</div>
					) : (
						<div className="SettingsModal__cleanupActions">
							{summary.isGlobalScope ? (
								<>
									<Button
										variant="danger"
										size={Button.SIZES.SMALL}
										disabled={isUndoEmpty || isBusy}
										onClick={() => onRequestConfirm("undo-all")}
									>
										{lang.t("Clear all Undo/Redo")}
									</Button>
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										disabled={isAppUndoEmpty || isBusy}
										onClick={() => onRequestConfirm("undo-application")}
									>
										{lang.t("Application only ({size})", {
											size: formatBytes(summary.undoRedo.applicationBytes),
										})}
									</Button>
								</>
							) : (
								<Button
									variant="danger"
									size={Button.SIZES.SMALL}
									disabled={isUndoEmpty || isBusy}
									onClick={() => onRequestConfirm("undo-campaign")}
								>
									{lang.t("Clear Undo/Redo")}
								</Button>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function SettingsScopedGroup({
	activeSection,
	scope,
	notes,
	sources,
	ai,
	storage,
	EditableField,
}: {
	activeSection: SettingsSection;
	scope: SettingsScopeViewProps;
	notes: SettingsNotesViewProps;
	sources: SettingsSourcesViewProps;
	ai: SettingsAiViewProps;
	storage: SettingsStorageViewProps;
} & SettingsModalCompositionSlots) {
	return (
		<div className="SettingsModal__group SettingsModal__section">
			<div className="SettingsModal__sectionHeader">
				<h3>
					{lang.t(
						activeSection === "ai"
							? "AI settings"
							: activeSection === "storage"
								? "Data & history"
								: "Campaign settings",
					)}
				</h3>
			</div>
			<label className="SettingsModal__field SettingsModal__scope">
				<span className="SettingsModal__label">{lang.t("Apply to")}</span>
				<Select
					aria-label={lang.t("Apply to")}
					value={scope.selectedScope}
					onChange={(event) => scope.onScopeChange(event.target.value)}
				>
					<option value={GLOBAL_SETTINGS_SCOPE}>
						{lang.t("Global settings")}
					</option>
					{scope.campaigns.length === 0 && (
						<option value="">{lang.t("No campaigns")}</option>
					)}
					{scope.campaigns.map((campaign) => (
						<option key={campaign.slug} value={campaign.slug}>
							{campaign.name}
						</option>
					))}
				</Select>
			</label>

			<div hidden={activeSection !== "campaign"}>
			<div className="SettingsModal__group SettingsModal__subsection">
				<Switch
					checked={notes.simplifiedNotesEnabled}
					onChange={notes.onSimplifiedNotesChange}
					label={lang.t("Simplified notes mode")}
					description={
						notes.isInherited
							? lang.t("Uses the global simplified notes setting.")
							: lang.t(
									"Use plain text notes without title and markdown preview",
								)
					}
				/>
			</div>

			<SettingsSourcesGroup {...sources} />
			</div>
			<div hidden={activeSection !== "ai"}>
			<SettingsAiGroup {...ai} EditableField={EditableField} />
			</div>
			<div hidden={activeSection !== "storage"}>
			<SettingsStorageGroup {...storage} />
			</div>
		</div>
	);
}

export default function SettingsModalView({
	notification,
	general,
	scope,
	notes,
	sources,
	ai,
	storage,
	onNotificationClose,
	EditableField,
}: SettingsModalViewProps & SettingsModalCompositionSlots) {
	const [activeSection, setActiveSection] = useState<SettingsSection>("general");
	const sections: Array<{ id: SettingsSection; label: string }> = [
		{ id: "general", label: "General" },
		{ id: "campaign", label: "Campaign" },
		{ id: "ai", label: "AI assistant" },
		{ id: "storage", label: "Data & history" },
	];
	return (
		<div className="SettingsModal">
			{notification && (
				<Notification message={notification} onClose={onNotificationClose} />
			)}
			<div className="SettingsModal__layout">
				<nav className="SettingsModal__navigation" aria-label={lang.t("Settings")}>
					{sections.map((section) => (
						<Button key={section.id} variant={activeSection === section.id ? "primary" : "ghost"} onClick={() => setActiveSection(section.id)} aria-pressed={activeSection === section.id}>
							{lang.t(section.label)}
						</Button>
					))}
				</nav>
				<div className="SettingsModal__content">
			<div hidden={activeSection !== "general"}><SettingsGeneralGroup {...general} /></div>
			<div hidden={activeSection === "general"}>
			<SettingsScopedGroup
				activeSection={activeSection}
				scope={scope}
				notes={notes}
				sources={sources}
				ai={ai}
				storage={storage}
				EditableField={EditableField}
			/>
			</div>
				</div>
			</div>
			<div className="SettingsModal__footer">
				<span>{lang.t("Changes save automatically")}</span>
			</div>
		</div>
	);
}
