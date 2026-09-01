import { useRef, type ReactNode } from "react";
import {
	LocationCardModel,
	type CardNote,
	type LocationData,
} from "../../../entities/campaign/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import { ImageAssetField } from "../../../features/images/index.js";
import { renderMentionText } from "../../../features/entity-link/index.js";
import { useSimplifiedNotesEnabled } from "../../../features/notes/ui/index.js";
import { classNames, getNotesForRender, lang } from "../../../shared/lib/index.js";
import { Button, CollapseToggleButton } from "../../../shared/ui/index.js";
import "../../../assets/components/LocationCard.css";
import {
	getCampaignEntityFieldClass,
	getLocationCardPresentation,
	getLocationDisplayName,
	type CampaignCardEntityId,
	type CampaignCardViewMode,
	type CampaignEntityHighlightFields,
} from "../model/campaignEntityCard.ts";
import CampaignEntityCardNotes from "./CampaignEntityCardNotes.tsx";
import { makeHistoryTargetId } from "../../../entities/history/index.js";

export interface LocationCardProps {
	location: LocationData;
	isDragging?: boolean;
	onToggleCollapse?: ((id: CampaignCardEntityId) => void) | null;
	onChange: (id: CampaignCardEntityId, location: LocationData) => void;
	onNameBlur?: (id: CampaignCardEntityId, location: LocationData, oldName: string, newName: string) => boolean | void | Promise<boolean | void>;
	onDelete?: (id: CampaignCardEntityId) => void;
	onReorderDrop?: (notes: CardNote[]) => void;
	campaignSlug?: string | null;
	enableHistory?: boolean;
	viewMode?: CampaignCardViewMode;
	historyScope?: "campaign" | "session";
	showDeleteButton?: boolean;
	showHeader?: boolean;
	headerActions?: ReactNode;
	highlightFields?: CampaignEntityHighlightFields | null;
}

interface LocationCardHeaderProps extends Pick<LocationCardProps, "location" | "viewMode" | "showDeleteButton" | "headerActions" | "onToggleCollapse" | "onDelete"> {
	model: LocationCardModel;
	displayName: string;
	canCollapseCard: boolean;
	isCollapsed: boolean;
}

function LocationCardHeader({ location, model, displayName, viewMode, canCollapseCard, isCollapsed, showDeleteButton, headerActions, onToggleCollapse, onDelete }: LocationCardHeaderProps) {
	return (
		<div className="LocationCard__header" onClick={!canCollapseCard ? undefined : () => onToggleCollapse?.(location.id)}>
			{canCollapseCard && <CollapseToggleButton size={Button.SIZES.SMALL} collapsed={isCollapsed} onClick={() => onToggleCollapse?.(location.id)} />}
			{location.imageUrl && isCollapsed && <div className="LocationCard__miniImage"><img src={location.imageUrl} alt="" /></div>}
			<LocationHeaderIdentity model={model} displayName={displayName} viewMode={viewMode} isCollapsed={isCollapsed} />
			<LocationHeaderActions location={location} headerActions={headerActions} showDeleteButton={showDeleteButton} onDelete={onDelete} />
		</div>
	);
}

function LocationHeaderIdentity({ model, displayName, viewMode, isCollapsed }: Pick<LocationCardHeaderProps, "model" | "displayName" | "viewMode" | "isCollapsed">) {
	return <div className="LocationCard__titleGroup">{viewMode !== "modal" && <span className="LocationCard__name">{displayName}</span>}{isCollapsed && model.briefMeta && <span className="LocationCard__metaBrief">{renderMentionText(model.briefMeta)}</span>}</div>;
}

function LocationHeaderActions({ location, headerActions, showDeleteButton, onDelete }: Pick<LocationCardHeaderProps, "location" | "headerActions" | "showDeleteButton" | "onDelete">) {
	return <>{headerActions && <div className="LocationCard__actions" onClick={(event) => event.stopPropagation()}>{headerActions}</div>}{showDeleteButton && <Button variant="danger" icon="trash" size={Button.SIZES.SMALL} iconSize={14} onClick={(event) => { event.stopPropagation(); onDelete?.(location.id); }} />}</>;
}

export default function LocationCard({
	location,
	isDragging = false,
	onToggleCollapse,
	onChange,
	onNameBlur,
	onDelete,
	onReorderDrop,
	campaignSlug,
	enableHistory = true,
	viewMode = "card",
	historyScope = "campaign",
	showDeleteButton = true,
	showHeader = true,
	headerActions = null,
	highlightFields = null,
}: LocationCardProps) {
	const model = new LocationCardModel(location);
	const initialName = getLocationDisplayName(location);
	const editingStartNameRef = useRef(initialName);
	const simplifiedNotes = useSimplifiedNotesEnabled();
	const notesForRender = getNotesForRender(model.notes, { simplifiedNotes });
	const presentation = getLocationCardPresentation(location, model.notes, viewMode, typeof onToggleCollapse === "function");
	const displayName = model.displayName || lang.t("New location/faction");
	const updateField = (field: string, value: unknown) => onChange(location.id, model.withField(field, value));
	const handleNameBlur = async () => {
		const oldName = editingStartNameRef.current ?? getLocationDisplayName(location);
		const newName = getLocationDisplayName(location);
		const shouldAdvance = await onNameBlur?.(location.id, location, oldName, newName) ?? true;
		if (shouldAdvance) editingStartNameRef.current = newName;
	};
	return (
		<div data-history-focus-id={makeHistoryTargetId(historyScope, "location", location.id)} className={classNames("LocationCard", { is_collapsed: presentation.isCollapsed, is_dragging: isDragging, LocationCard__modal: viewMode === "modal" })} onClick={() => presentation.isCollapsed && onToggleCollapse?.(location.id)}>
			{showHeader && <LocationCardHeader location={location} model={model} displayName={displayName} viewMode={viewMode} canCollapseCard={presentation.canCollapseCard} isCollapsed={presentation.isCollapsed} showDeleteButton={showDeleteButton} headerActions={headerActions} onToggleCollapse={onToggleCollapse} onDelete={onDelete} />}
			{!presentation.isCollapsed && (
				<div className="LocationCard__body">
					<div className="LocationCard__imageSide"><ImageAssetField imageUrl={location.imageUrl} campaignSlug={campaignSlug} target="location" showClearButton onImageChange={(url) => updateField("imageUrl", url)} imageAlt={lang.t("Image")} containerClassName="LocationCard__imageContainer" wrapperClassName={classNames("LocationCard__imageWrapper", "is_editable")} deleteButtonClassName="LocationCard__imageDelete" previewTitle={displayName || lang.t("Image")} previewModalClassName="LocationCard__imageModal" previewContentClassName="LocationCard__imageModalContent" /></div>
					<div><div className="LocationCard__grid"><EditableField data-history-field="name" type="text" value={location.name ?? ""} enableHistory={enableHistory} onChange={(event) => updateField("name", event.target.value)} onBlur={() => { void handleNameBlur(); }} placeholder={lang.t("Name")} className={getCampaignEntityFieldClass(highlightFields, "name")} /></div></div>
					<div className="LocationCard__details"><div className="LocationCard__field"><EditableField data-history-field="description" type="textarea" value={location.description ?? ""} enableHistory={enableHistory} onChange={(event) => updateField("description", event.target.value)} placeholder={lang.t("Briefly describe the location or faction...")} className={getCampaignEntityFieldClass(highlightFields, "description")} /></div></div>
					<CampaignEntityCardNotes classPrefix="LocationCard" historyScope={historyScope} historyKind="location" entityId={location.id} model={model} notesForRender={notesForRender} hasNotesData={presentation.hasNotesData} isNotesCollapsed={presentation.isNotesCollapsed} currentNotesCollapsed={Boolean(location.isNotesCollapsed)} campaignSlug={campaignSlug} enableHistory={enableHistory} label={lang.t("Notes")} highlightFields={highlightFields} onChange={onChange} onReorderDrop={onReorderDrop} />
				</div>
			)}
		</div>
	);
}
