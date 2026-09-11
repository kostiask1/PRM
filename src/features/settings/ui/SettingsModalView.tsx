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
import type { SettingsModalCompositionSlots } from "./settingsModalComposition.ts";

export interface SettingsGeneralViewProps {
	currentTheme: Theme;
	currentLanguage: string;
	availableLanguages: string[];
	autoApplyAiChanges: boolean;
	useSearchDebounce: boolean;
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

export interface SettingsModalViewProps {
	notification: string | null;
	general: SettingsGeneralViewProps;
	scope: SettingsScopeViewProps;
	notes: SettingsNotesViewProps;
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
	autoApplyAiChanges,
	useSearchDebounce,
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
								{lang.t("Use global sources")}
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
			<div className="SettingsModal__sectionHeader">
				<h3>{lang.t("AI settings")}</h3>
				{status === "saving" && (
					<span className="SettingsModal__saveStatus" role="status">
						{lang.t("Saving...")}
					</span>
				)}
			</div>
			<div className="SettingsModal__promptGrid">
				<label className="SettingsModal__field">
					<span className="SettingsModal__label">{lang.t("AI base prompt")}</span>
					<div className="SettingsModal__hint">
						{isGlobalScope
							? lang.t("These instructions are added to every future AI request.")
							: lang.t("Used instead of the global AI prompt for this campaign.")}
					</div>
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
						disabled={false}
					/>
				</label>
			</div>
		</div>
	);
}

function SettingsScopedGroup({
	scope,
	notes,
	sources,
	ai,
	EditableField,
}: {
	scope: SettingsScopeViewProps;
	notes: SettingsNotesViewProps;
	sources: SettingsSourcesViewProps;
	ai: SettingsAiViewProps;
} & SettingsModalCompositionSlots) {
	return (
		<div className="SettingsModal__group SettingsModal__section">
			<div className="SettingsModal__sectionHeader">
				<h3>{lang.t("Campaign settings")}</h3>
			</div>
			<label className="SettingsModal__field SettingsModal__scope">
				<Select
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
			<SettingsAiGroup {...ai} EditableField={EditableField} />
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
	onNotificationClose,
	EditableField,
}: SettingsModalViewProps & SettingsModalCompositionSlots) {
	return (
		<div className="SettingsModal">
			{notification && (
				<Notification message={notification} onClose={onNotificationClose} />
			)}
			<SettingsGeneralGroup {...general} />
			<SettingsScopedGroup
				scope={scope}
				notes={notes}
				sources={sources}
				ai={ai}
				EditableField={EditableField}
			/>
		</div>
	);
}
