import type {
	CampaignEntityRecord,
	CharacterData,
} from "../../../../entities/campaign/index.js";
import "../../../../assets/components/EncounterCharacterOverlays.css";
import { getEncounterCharacterDisplayName } from "../../../../entities/encounter/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { Button, Modal } from "../../../../shared/ui/index.js";
import {
	CharacterCard,
	type CharacterCardProps,
} from "../../../../widgets/campaign-entity-card/index.js";
import type { EncounterViewParticipant } from "../../model/contracts.ts";

type EncounterCharacterDraft = CharacterData & { firstName: string };

interface EncounterCharacterOverlaysProps {
	open: boolean;
	creating: boolean;
	submitting: boolean;
	draft: EncounterCharacterDraft;
	available: CampaignEntityRecord[];
	allCharacters: CampaignEntityRecord[];
	modalCharacter: EncounterViewParticipant | null;
	campaignSlug: string;
	onClosePicker: () => void;
	onDraft: (draft: EncounterCharacterDraft) => void;
	onCreate: () => void;
	onReset: () => void;
	onStartCreate: () => void;
	onAdd: (character: CampaignEntityRecord) => void;
	onCloseCharacter: () => void;
	getModalCharacterOnChange: (
		character: EncounterViewParticipant,
	) => CharacterCardProps["onChange"];
}

export default function EncounterCharacterOverlays(
	props: EncounterCharacterOverlaysProps,
) {
	return (
		<>
			<EncounterCharacterPickerOverlay {...props} />
			<EncounterCharacterModalOverlay {...props} />
		</>
	);
}

function EncounterCharacterPickerOverlay(props: EncounterCharacterOverlaysProps) {
	if (!props.open) return null;
	return (
		<Modal
			onConfirm={() => {}}
			title={
				props.creating ? lang.t("New character") : lang.t("Choose player")
			}
			onCancel={props.onClosePicker}
			showFooter={false}
			type="custom"
		>
			<div className="EncounterCharacterOverlays">
				{props.creating ? (
					<EncounterCharacterCreateForm {...props} />
				) : (
					<EncounterCharacterList {...props} />
				)}
			</div>
		</Modal>
	);
}

function EncounterCharacterCreateForm({
	draft,
	submitting,
	campaignSlug,
	onDraft,
	onCreate,
	onReset,
}: EncounterCharacterOverlaysProps) {
	return (
		<div className="EncounterCharacterOverlays__create">
			<CharacterCard
				character={draft}
				onChange={(_id, updated) => onDraft(updated as EncounterCharacterDraft)}
				onDelete={() => {}}
				onToggleCollapse={null}
				campaignSlug={campaignSlug}
				type="characters"
				viewMode="modal"
				showDeleteButton={false}
				showHeader={false}
			/>
			<div className="EncounterCharacterOverlays__createActions">
				<Button
					variant="primary"
					onClick={onCreate}
					disabled={submitting || !draft.firstName.trim()}
				>
					{lang.t("Create")}
				</Button>
				<Button variant="ghost" onClick={onReset} disabled={submitting}>
					{lang.t("Back")}
				</Button>
			</div>
		</div>
	);
}

function EncounterCharacterList({
	available,
	allCharacters,
	onStartCreate,
	onAdd,
}: EncounterCharacterOverlaysProps) {
	return (
		<>
			<Button
				variant="create"
				icon="plus"
				onClick={onStartCreate}
				className="EncounterCharacterOverlays__createButton"
			>
				{lang.t("New character")}
			</Button>
			{available.length > 0 ? (
				available.map((character) => (
					<button
						type="button"
						key={String(character.id || character.slug)}
					className="EncounterCharacterOverlays__item"
						onClick={() => onAdd(character)}
					>
						<span className="EncounterCharacterOverlays__name">
							{getEncounterCharacterDisplayName(character)}
						</span>
						<span className="EncounterCharacterOverlays__meta">
							{[character.race, character.class].filter(Boolean).join(" • ")}
							{character.level
								? ` • ${lang.t("Lvl. {level}", { level: character.level })}`
								: ""}
						</span>
					</button>
				))
			) : (
				<EncounterCharacterEmptyState
					hasCharacters={allCharacters.length > 0}
				/>
			)}
		</>
	);
}

function EncounterCharacterEmptyState({
	hasCharacters,
}: {
	hasCharacters: boolean;
}) {
	return (
		<p className="muted">
			{hasCharacters
				? lang.t("All player characters are already in encounter.")
				: lang.t("No player characters found.")}
		</p>
	);
}

function EncounterCharacterModalOverlay({
	modalCharacter,
	campaignSlug,
	onCloseCharacter,
	getModalCharacterOnChange,
}: EncounterCharacterOverlaysProps) {
	if (!modalCharacter) return null;
	return (
		<Modal
			onConfirm={() => {}}
			title={getEncounterCharacterDisplayName(modalCharacter)}
			onCancel={onCloseCharacter}
			showFooter={false}
			type="custom"
		>
			<CharacterCard
				character={modalCharacter}
				campaignSlug={campaignSlug}
				type="characters"
				viewMode="modal"
				showDeleteButton={false}
				onChange={getModalCharacterOnChange(modalCharacter)}
			/>
		</Modal>
	);
}
