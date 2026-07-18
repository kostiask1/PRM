import { useState } from "react";
import type { CampaignEntityRecord, CampaignEntityType, CharacterData } from "../../../entities/campaign/index.js";
import { buildCreateEntityPayload, submitCreateEntity } from "../../../features/campaign-entity/index.js";
import { Modal } from "../../../features/modal/index.js";
import { lang } from "../../../shared/lib/index.js";
import { alert, useAppDispatch } from "../../../shared/model/index.js";
import { Button, type ButtonSize, type ButtonVariant, type IconName } from "../../../shared/ui/index.js";
import "../../../assets/components/CreateCharacterButton.css";
import { createCharacterDraft, isCharacterDraftValid } from "../model/campaignEntityCard.ts";
import CharacterCard from "./CharacterCard.tsx";

export interface CreateCharacterButtonProps {
	campaignSlug: string;
	entityType?: CampaignEntityType;
	buttonLabel?: string;
	buttonVariant?: ButtonVariant;
	buttonSize?: ButtonSize;
	buttonClassName?: string;
	icon?: IconName;
	onCreate?: ((payload: CampaignEntityRecord) => void | Promise<void>) | null;
}

export default function CreateCharacterButton({
	campaignSlug,
	entityType = "characters",
	buttonLabel,
	buttonVariant = "primary",
	buttonSize = Button.SIZES.SMALL,
	buttonClassName,
	icon = "plus",
	onCreate = null,
}: CreateCharacterButtonProps) {
	const dispatch = useAppDispatch();
	const [isOpen, setIsOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [draft, setDraft] = useState<CharacterData>(() => createCharacterDraft(entityType));
	const isNpc = entityType === "npc";
	const modalTitle = isNpc ? lang.t("New NPC") : lang.t("New character");
	const openModal = () => { setDraft(createCharacterDraft(entityType)); setIsOpen(true); };
	const closeModal = () => { if (!isSubmitting) setIsOpen(false); };
	const handleSubmit = async () => {
		if (!isCharacterDraftValid(draft)) {
			dispatch(alert({ title: lang.t("Error"), message: lang.t("Name is required to create an entry.") }));
			return;
		}
		const payload = buildCreateEntityPayload({ firstName: "", lastName: "", race: "", class: "", level: 1, motivation: "", description: "", trait: "", notes: [], collapsed: false, isNotesCollapsed: false }, draft);
		setIsSubmitting(true);
		try {
			await submitCreateEntity({ campaignSlug, entityType, payload, onCreate: onCreate ?? undefined, dispatch });
			setIsOpen(false);
		} catch (error) {
			console.error("Failed to create entity from modal", error);
			dispatch(alert({ title: lang.t("Error"), message: lang.t("Failed to create entity.") }));
		} finally {
			setIsSubmitting(false);
		}
	};
	return (
		<>
			<Button variant={buttonVariant} size={buttonSize} onClick={openModal} className={buttonClassName} icon={icon}>{buttonLabel || modalTitle}</Button>
			{isOpen && (
				<Modal title={modalTitle} type="confirm" showFooter={false} onConfirm={closeModal} onCancel={closeModal}>
					<div className="CreateCharacterModal">
						<CharacterCard character={draft} onChange={(_id, updated) => setDraft(updated)} onDelete={() => {}} onToggleCollapse={null} campaignSlug={campaignSlug} type={entityType} viewMode="modal" showDeleteButton={false} showHeader={false} />
						<div className="CreateCharacterModal__actions">
							<Button variant="primary" onClick={() => { void handleSubmit(); }} disabled={isSubmitting || !isCharacterDraftValid(draft)}>{lang.t("Create")}</Button>
							<Button variant="ghost" onClick={closeModal} disabled={isSubmitting}>{lang.t("Cancel")}</Button>
						</div>
					</div>
				</Modal>
			)}
		</>
	);
}
