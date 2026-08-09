import type { SettingsCampaign } from "../model/settingsModal.ts";
import type { Theme } from "../model/theme.ts";
import {
	DEFAULT_IMAGE_PROMPT_BASE_PROMPT,
	GLOBAL_SETTINGS_SCOPE,
	type SettingsSaveStatus,
} from "../model/settingsModal.ts";
import { THEMES } from "../model/theme.ts";
import { lang } from "../../../shared/lib/index.js";
import { formatSourceLabel } from "../../../entities/reference/index.js";
import {
	Button,
	MultiSelect,
	Notification,
	Select,
	Switch,
} from "../../../shared/ui/index.js";
import ColorThemeSwitcher from "./ColorThemeSwitcher.tsx";
import CampaignScopeOptions from "./CampaignScopeOptions.tsx";
import type { SettingsModalCompositionSlots } from "./settingsModalComposition.ts";

export interface SettingsGeneralViewProps {
	currentTheme: Theme;
	currentLanguage: string;
	availableLanguages: string[];
	simplifiedNotesEnabled: boolean;
	useSearchDebounce: boolean;
	onThemeToggle: () => void;
	onLanguageChange: (language: string) => void;
	onSimplifiedNotesChange: (enabled: boolean) => void;
	onUseSearchDebounceChange: (enabled: boolean) => void;
}

export interface SettingsSourcesViewProps {
	campaigns: SettingsCampaign[];
	selectedScope: string;
	isGlobalScope: boolean;
	status: SettingsSaveStatus;
	options: string[];
	selectedSources: string[];
	onScopeChange: (scope: string) => void;
	onSelectedSourcesChange: (sources: string[]) => void;
	onCopyGlobal: () => void;
	onSave: () => void;
}

export interface SettingsAiViewProps {
	campaigns: SettingsCampaign[];
	selectedScope: string;
	isGlobalScope: boolean;
	status: SettingsSaveStatus;
	autoApplyAiChanges: boolean;
	basePrompt: string;
	imagePrompt: string;
	onScopeChange: (scope: string) => void;
	onAutoApplyAiChangesChange: (enabled: boolean) => void;
	onBasePromptChange: (value: string) => void;
	onImagePromptChange: (value: string) => void;
	onSave: () => void;
}

export interface SettingsModalViewProps {
	notification: string | null;
	general: SettingsGeneralViewProps;
	sources: SettingsSourcesViewProps;
	ai: SettingsAiViewProps;
	onNotificationClose: () => void;
	onCancel: () => void;
}

type SettingsAiGroupProps = SettingsAiViewProps & SettingsModalCompositionSlots;

function SettingsGeneralGroup({
	currentTheme,
	currentLanguage,
	availableLanguages,
	simplifiedNotesEnabled,
	useSearchDebounce,
	onThemeToggle,
	onLanguageChange,
	onSimplifiedNotesChange,
	onUseSearchDebounceChange,
}: SettingsGeneralViewProps) {
	return (
		<div className="SettingsModal__group">
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

			<Switch
				checked={simplifiedNotesEnabled}
				onChange={onSimplifiedNotesChange}
				label={lang.t("Simplified notes mode")}
				description={lang.t(
					"Use plain text notes without title and markdown preview",
				)}
			/>
			<Switch
				checked={useSearchDebounce}
				onChange={onUseSearchDebounceChange}
				label={lang.t("Use search debounce")}
				description={lang.t(
					"When disabled, search results update immediately while typing.",
				)}
			/>
		</div>
	);
}

function SettingsSourcesGroup({
	campaigns,
	selectedScope,
	isGlobalScope,
	status,
	options,
	selectedSources,
	onScopeChange,
	onSelectedSourcesChange,
	onCopyGlobal,
	onSave,
}: SettingsSourcesViewProps) {
	return (
		<div className="SettingsModal__group SettingsModal__section">
			<div className="SettingsModal__promptHeader">
				<div>
					<div className="SettingsModal__label">
						{lang.t("Content sources")}
					</div>
					<div className="SettingsModal__hint">
						{lang.t(
							"Unchecked sources are hidden in Bestiary, Spells, and official tokens.",
						)}
					</div>
				</div>
				<Button
					variant="primary"
					onClick={onSave}
					disabled={status === "saving"}
				>
					{status === "saving" ? lang.t("Saving...") : lang.t("Save sources")}
				</Button>
			</div>

			<div className="SettingsModal__field">
				<span className="SettingsModal__label">{lang.t("Visible sources")}</span>
				<Select
					value={selectedScope}
					onChange={(event) => onScopeChange(event.target.value)}
				>
					<option value={GLOBAL_SETTINGS_SCOPE}>
						{lang.t("Global source settings")}
					</option>
					<CampaignScopeOptions campaigns={campaigns} />
				</Select>
				<div className="SettingsModal__sourceRow">
					<MultiSelect
						className="SettingsModal__sourceSelect"
						value={selectedSources}
						onChange={onSelectedSourcesChange}
						optionClickMode="toggle"
						disabled={!isGlobalScope && !selectedScope}
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
					{!isGlobalScope && selectedScope && (
						<div className="SettingsModal__inlineActions">
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								onClick={onCopyGlobal}
							>
								{lang.t("Copy global settings")}
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function SettingsAiGroup({
	campaigns,
	selectedScope,
	isGlobalScope,
	status,
	autoApplyAiChanges,
	basePrompt,
	imagePrompt,
	onScopeChange,
	onAutoApplyAiChangesChange,
	onBasePromptChange,
	onImagePromptChange,
	onSave,
	EditableField,
}: SettingsAiGroupProps) {
	return (
		<div className="SettingsModal__group SettingsModal__section SettingsModal__section_ai">
			<div className="SettingsModal__sectionHeader">
				<h3>{lang.t("AI settings")}</h3>
			</div>
			<Switch
				checked={autoApplyAiChanges}
				onChange={onAutoApplyAiChangesChange}
				label={lang.t("Apply parsed AI changes automatically")}
				description={lang.t(
					"When disabled, parsed AI responses are saved as drafts for review before applying.",
				)}
			/>
			<div className="SettingsModal__promptHeader">
				<div>
					<div className="SettingsModal__label">{lang.t("AI base prompt")}</div>
					<div className="SettingsModal__hint">
						{lang.t("These instructions are added to every future AI request.")}
					</div>
				</div>
				<Button
					variant="primary"
					onClick={onSave}
					disabled={status === "saving"}
				>
					{status === "saving" ? lang.t("Saving...") : lang.t("Save prompts")}
				</Button>
			</div>

			<label className="SettingsModal__field">
				<span className="SettingsModal__label">{lang.t("AI base prompt")}</span>
				<Select
					value={selectedScope}
					onChange={(event) => onScopeChange(event.target.value)}
				>
					<option value={GLOBAL_SETTINGS_SCOPE}>{lang.t("Global base prompt")}</option>
					<CampaignScopeOptions campaigns={campaigns} />
				</Select>
				<EditableField
					type="textarea"
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
					disabled={!isGlobalScope && !selectedScope}
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
						: lang.t("Used instead of the global image style for this campaign.")}
				</div>
				<EditableField
					type="textarea"
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
					disabled={!isGlobalScope && !selectedScope}
				/>
			</label>
		</div>
	);
}

export default function SettingsModalView({
	notification,
	general,
	sources,
	ai,
	onNotificationClose,
	onCancel,
	EditableField,
}: SettingsModalViewProps & SettingsModalCompositionSlots) {
	return (
		<div className="SettingsModal">
			{notification && (
				<Notification message={notification} onClose={onNotificationClose} />
			)}
			<SettingsGeneralGroup {...general} />
			<SettingsSourcesGroup {...sources} />
			<SettingsAiGroup {...ai} EditableField={EditableField} />
			<div className="SettingsModal__actions">
				<Button variant="ghost" onClick={onCancel}>
					{lang.t("Close")}
				</Button>
			</div>
		</div>
	);
}
