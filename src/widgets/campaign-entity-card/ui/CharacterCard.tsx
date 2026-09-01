import { useRef, type ReactNode } from "react";
import {
	CharacterCardModel,
	type CardNote,
	type CharacterData,
} from "../../../entities/campaign/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import { ImageAssetField } from "../../../features/images/index.js";
import { renderMentionText } from "../../../features/entity-link/index.js";
import { useSimplifiedNotesEnabled } from "../../../features/notes/ui/index.js";
import { classNames, getNotesForRender, lang } from "../../../shared/lib/index.js";
import { Button, CollapseToggleButton, Select } from "../../../shared/ui/index.js";
import "../../../assets/components/CharacterCard.css";
import {
	getCampaignEntityFieldClass,
	getCharacterCardPresentation,
	getCharacterDisplayName,
	type CampaignCardEntityId,
	type CampaignCardViewMode,
	type CampaignEntityHighlightFields,
} from "../model/campaignEntityCard.ts";
import CampaignEntityCardNotes from "./CampaignEntityCardNotes.tsx";
import { makeHistoryTargetId } from "../../../entities/history/index.js";

export interface CharacterCardProps {
	character: CharacterData;
	onToggleCollapse?: ((id: CampaignCardEntityId) => void) | null;
	onChange: (id: CampaignCardEntityId, character: CharacterData) => void;
	onNameBlur?: (id: CampaignCardEntityId, character: CharacterData, oldName: string, newName: string) => boolean | void | Promise<boolean | void>;
	onDelete?: (id: CampaignCardEntityId) => void;
	onReorderDrop?: (notes: CardNote[]) => void;
	campaignSlug?: string | null;
	enableHistory?: boolean;
	type?: "characters" | "npc" | string;
	historyScope?: "campaign" | "session";
	viewMode?: CampaignCardViewMode;
	showDeleteButton?: boolean;
	showHeader?: boolean;
	headerActions?: ReactNode;
	highlightFields?: CampaignEntityHighlightFields | null;
}

interface CharacterSectionProps {
	character: CharacterData;
	model: CharacterCardModel;
	campaignSlug?: string | null;
	enableHistory: boolean;
	type: string;
	highlightFields?: CampaignEntityHighlightFields | null;
	updateField: (field: string, value: unknown) => void;
	onNameBlur: () => void;
}

function CharacterIdentityFields({ character, model, enableHistory, highlightFields, updateField, onNameBlur }: CharacterSectionProps) {
	const fieldClass = (field: string) => getCampaignEntityFieldClass(highlightFields, field);
	return (
		<div className="CharacterCard__infoSide">
			<div className="CharacterCard__grid">
				<EditableField data-history-field="firstName" type="text" value={character.firstName} enableHistory={enableHistory} onChange={(event) => updateField("firstName", event.target.value)} onBlur={onNameBlur} placeholder={lang.t("First name")} className={fieldClass("firstName")} />
				<EditableField data-history-field="lastName" type="text" value={character.lastName} enableHistory={enableHistory} onChange={(event) => updateField("lastName", event.target.value)} onBlur={onNameBlur} placeholder={lang.t("Last name")} className={fieldClass("lastName")} />
				<div className="CharacterCard__rowTrio">
					<EditableField data-history-field="race" type="text" value={character.race} enableHistory={enableHistory} onChange={(event) => updateField("race", event.target.value)} placeholder={lang.t("Race")} className={fieldClass("race")} />
					<EditableField data-history-field="class" type="text" value={character.class} enableHistory={enableHistory} onChange={(event) => updateField("class", event.target.value)} placeholder={lang.t("Class")} className={fieldClass("class")} />
					<Select value={model.level} onChange={(event) => updateField("level", event.target.value)}>
						<option value="">--</option>
						{CharacterCardModel.getLevelOptions().map((level) => <option key={level} value={level}>{lang.t("Level {level}", { level })}</option>)}
					</Select>
				</div>
			</div>
		</div>
	);
}

function CharacterDetails({ character, model, enableHistory, highlightFields, updateField }: CharacterSectionProps) {
	const fieldClass = (field: string) => getCampaignEntityFieldClass(highlightFields, field);
	return (
		<>
			<div className="CharacterCard__details">
				<div className="CharacterCard__field"><label>{lang.t("Motivation")}</label><EditableField data-history-field="motivation" type="textarea" value={character.motivation} enableHistory={enableHistory} onChange={(event) => updateField("motivation", event.target.value)} placeholder={lang.t("What does the character want...")} className={fieldClass("motivation")} /></div>
				<div className="CharacterCard__field"><label>{lang.t("Trait")}</label><EditableField data-history-field="trait" type="textarea" value={model.trait} enableHistory={enableHistory} onChange={(event) => updateField("trait", event.target.value)} placeholder={lang.t("Distinctive trait or habit...")} className={fieldClass("trait")} /></div>
			</div>
			<div className="CharacterCard__field"><label>{lang.t("Description")}</label><EditableField data-history-field="description" type="textarea" value={model.description} enableHistory={enableHistory} onChange={(event) => updateField("description", event.target.value)} placeholder={lang.t("Character description...")} className={fieldClass("description")} /></div>
		</>
	);
}

function CharacterCardHeader({ character, model, viewMode, canCollapseCard, isCollapsed, showDeleteButton, headerActions, onToggleCollapse, onDelete }: Pick<CharacterCardProps, "character" | "viewMode" | "showDeleteButton" | "headerActions" | "onToggleCollapse" | "onDelete"> & { model: CharacterCardModel; canCollapseCard: boolean; isCollapsed: boolean }) {
	return (
		<div className="CharacterCard__header" onClick={!canCollapseCard ? undefined : () => onToggleCollapse?.(character.id)}>
			{canCollapseCard && <CollapseToggleButton size={Button.SIZES.SMALL} collapsed={isCollapsed} onClick={() => onToggleCollapse?.(character.id)} />}
			{character.imageUrl && isCollapsed && <div className="CharacterCard__miniPortrait"><img src={character.imageUrl} alt="" /></div>}
			<div className="CharacterCard__titleGroup">
				{viewMode !== "modal" && <span className="CharacterCard__name">{model.displayName} {character.lastName}</span>}
				{isCollapsed && <span className="CharacterCard__metaBrief">{renderMentionText(model.briefMeta)}</span>}
			</div>
			{headerActions && <div className="CharacterCard__actions" onClick={(event) => event.stopPropagation()}>{headerActions}</div>}
			{showDeleteButton && <Button variant="danger" icon="trash" size={Button.SIZES.SMALL} iconSize={14} onClick={(event) => { event.stopPropagation(); onDelete?.(character.id); }} />}
		</div>
	);
}

export default function CharacterCard({
	character,
	onToggleCollapse,
	onChange,
	onNameBlur,
	onDelete,
	onReorderDrop,
	campaignSlug,
	enableHistory = true,
	type = "characters",
	historyScope = "campaign",
	viewMode = "card",
	showDeleteButton = true,
	showHeader = true,
	headerActions = null,
	highlightFields = null,
}: CharacterCardProps) {
	const model = new CharacterCardModel(character);
	const editingStartNameRef = useRef(model.fullName);
	const simplifiedNotes = useSimplifiedNotesEnabled();
	const notesForRender = getNotesForRender(model.notes, { simplifiedNotes });
	const presentation = getCharacterCardPresentation(character, model.notes, viewMode, typeof onToggleCollapse === "function");
	const historyKind = type === "npc" ? "npc" : "character";
	const updateField = (field: string, value: unknown) => onChange(character.id, model.withField(field, value));
	const handleNameBlur = async () => {
		const oldName = editingStartNameRef.current ?? getCharacterDisplayName(character);
		const newName = getCharacterDisplayName(character);
		const shouldAdvance = await onNameBlur?.(character.id, character, oldName, newName) ?? true;
		if (shouldAdvance) editingStartNameRef.current = newName;
	};
	const sectionProps: CharacterSectionProps = { character, model, campaignSlug, enableHistory, type, highlightFields, updateField, onNameBlur: () => { void handleNameBlur(); } };
	return (
		<div data-history-focus-id={makeHistoryTargetId(historyScope, historyKind, character.id)} className={classNames("CharacterCard", { is_collapsed: presentation.isCollapsed, CharacterCard__modal: viewMode === "modal" })} onClick={!presentation.canCollapseCard ? undefined : () => presentation.isCollapsed && onToggleCollapse?.(character.id)}>
			{showHeader && <CharacterCardHeader character={character} model={model} viewMode={viewMode} canCollapseCard={presentation.canCollapseCard} isCollapsed={presentation.isCollapsed} showDeleteButton={showDeleteButton} headerActions={headerActions} onToggleCollapse={onToggleCollapse} onDelete={onDelete} />}
			{!presentation.isCollapsed && (
				<div className="CharacterCard__body">
					<div className="CharacterCard__imageSide"><ImageAssetField imageUrl={character.imageUrl} campaignSlug={campaignSlug} target={type === "npc" ? "npc" : "character"} showClearButton onImageChange={(url) => updateField("imageUrl", url)} imageAlt={lang.t("Portrait")} containerClassName="CharacterCard__portraitContainer" wrapperClassName={classNames("CharacterCard__portraitWrapper", "is_editable")} deleteButtonClassName="CharacterCard__imageDelete" previewTitle={model.fullName || lang.t("Portrait")} previewModalClassName="CharacterCard__imageModal" previewContentClassName="CharacterCard__imageModalContent" /></div>
					<CharacterIdentityFields {...sectionProps} />
					<CharacterDetails {...sectionProps} />
					<CampaignEntityCardNotes classPrefix="CharacterCard" historyScope={historyScope} historyKind={historyKind} entityId={character.id} model={model} notesForRender={notesForRender} hasNotesData={presentation.hasNotesData} isNotesCollapsed={presentation.isNotesCollapsed} currentNotesCollapsed={Boolean(character.isNotesCollapsed)} campaignSlug={campaignSlug} enableHistory={enableHistory} label={lang.t("Character notes")} highlightFields={highlightFields} onChange={onChange} onReorderDrop={onReorderDrop} />
				</div>
			)}
		</div>
	);
}
