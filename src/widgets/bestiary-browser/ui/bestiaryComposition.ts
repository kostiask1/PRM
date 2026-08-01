import type {
	ComponentType,
	Dispatch,
	ReactElement,
	ReactNode,
	RefObject,
	SetStateAction,
} from "react";
import type {
	BestiaryFavorite,
	BestiaryMonster,
} from "../../../entities/bestiary/index.js";
import type {
	AiHistoryEntry,
	AiHistoryResource,
	AiModelDescriptor,
	DiffResource,
} from "../../../features/ai/index.js";
import type {
	AiResponseHistoryEntry,
	AiResponseModalComponent,
	AiResponseModalProps,
	AiUiAttachment,
} from "../../../features/ai/ui/index.js";
import type { MonsterAiEditMode } from "../../../features/ai-edit-monster/index.js";

export interface BestiaryAssistantSlotProps {
	ResponseModal: AiResponseModalComponent;
	isBestiary: boolean;
	onRegisterImagePromptAction: (
		handler: ((monster: BestiaryMonster) => void) | null,
	) => void;
}

export type BestiaryAssistantSlot =
	ComponentType<BestiaryAssistantSlotProps>;

export interface BestiaryMonsterStatBlockSlotProps {
	monster: BestiaryMonster;
	favoriteActive: boolean;
	onNameClick?: (monster: BestiaryMonster) => void;
	nameTitle?: ReactNode;
	onFavoriteChange: Dispatch<SetStateAction<BestiaryFavorite[]>>;
	showAddToEncounterPicker: boolean;
	onAddToEncounter?: (monster: BestiaryMonster) => void;
	onAiAction: (monster: BestiaryMonster) => void;
	onDelete?: (monster: BestiaryMonster) => void;
	onFieldEdit: (monster: BestiaryMonster) => void;
	searchHighlight: string;
}

export type BestiaryMonsterStatBlockSlot =
	ComponentType<BestiaryMonsterStatBlockSlotProps>;

export type BestiaryAiDraftRestore = (
	entry: AiResponseHistoryEntry,
	resourceIds?: string[],
) => void | Promise<void>;

export interface BestiaryAiModalsSlotProps {
	ResponseModal: AiResponseModalComponent;
	aiDraftDiffResources: DiffResource[];
	aiDraftResponseEntry?: AiResponseHistoryEntry | null;
	aiDraftResponseRef: RefObject<HTMLDivElement | null>;
	aiEditAttachedFiles?: AiUiAttachment[];
	aiEditAttachedImages?: AiUiAttachment[];
	aiEditingMonster?: BestiaryMonster | null;
	aiEditError?: string | null;
	aiEditInstructions: string;
	aiEditMode: MonsterAiEditMode;
	aiModels: AiModelDescriptor[];
	getDiffResourceState: (resource: AiHistoryResource) => string;
	getHistoryChangeSummary: (entry: AiHistoryEntry) => string;
	isAiEditingMonster: boolean;
	isRestoringAiResponse: boolean;
	onApplyDraft: BestiaryAiDraftRestore;
	onApplyDraftResource: BestiaryAiDraftRestore;
	onCancelDraft: () => void;
	onCancelEdit: () => void;
	onCancelEditRequest: () => void;
	onInstructionsChange: (value: string) => void;
	onModelChange: (value: string) => void;
	onSaveDraftChanges: AiResponseModalProps["onSaveDraftChanges"];
	onSaveEdit: () => void;
	onUndoDraft: BestiaryAiDraftRestore;
	onUndoDraftResource: BestiaryAiDraftRestore;
	selectedAiModel: string;
	setAiEditAttachedFiles?: Dispatch<SetStateAction<AiUiAttachment[]>>;
	setAiEditAttachedImages?: Dispatch<SetStateAction<AiUiAttachment[]>>;
}

export type BestiaryAiModalsSlot = (
	props: BestiaryAiModalsSlotProps,
) => ReactElement | null;
