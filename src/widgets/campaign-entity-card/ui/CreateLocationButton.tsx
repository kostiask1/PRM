import { useState } from "react";
import type { CampaignEntityRecord, LocationData } from "../../../entities/campaign/index.js";
import { buildCreateEntityPayload, submitCreateEntity } from "../../../features/campaign-entity/index.js";
import { lang } from "../../../shared/lib/index.js";
import { alert, useAppDispatch } from "../../../shared/model/index.js";
import {
	Button,
	Modal,
	type ButtonSize,
	type ButtonVariant,
	type IconName,
} from "../../../shared/ui/index.js";
import "../../../assets/components/CreateCharacterButton.css";
import { createLocationDraft, isLocationDraftValid } from "../model/campaignEntityCard.ts";
import LocationCard from "./LocationCard.tsx";

export interface CreateLocationButtonProps {
	campaignSlug: string;
	buttonLabel?: string;
	buttonVariant?: ButtonVariant;
	buttonSize?: ButtonSize;
	buttonClassName?: string;
	icon?: IconName;
	onCreate?: ((payload: CampaignEntityRecord) => void | Promise<void>) | null;
}

export default function CreateLocationButton({
	campaignSlug,
	buttonLabel,
	buttonVariant = "primary",
	buttonSize = Button.SIZES.SMALL,
	buttonClassName,
	icon = "plus",
	onCreate = null,
}: CreateLocationButtonProps) {
	const dispatch = useAppDispatch();
	const [isOpen, setIsOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [draft, setDraft] = useState<LocationData>(() => createLocationDraft());
	const title = lang.t("New location/faction");
	const openModal = () => { setDraft(createLocationDraft()); setIsOpen(true); };
	const closeModal = () => { if (!isSubmitting) setIsOpen(false); };
	const handleSubmit = async () => {
		if (!isLocationDraftValid(draft)) {
			dispatch(alert({ title: lang.t("Error"), message: lang.t("Name is required to create an entry.") }));
			return;
		}
		const payload = buildCreateEntityPayload({ name: "", description: "", notes: [], imageUrl: null, collapsed: false, isNotesCollapsed: false }, draft);
		setIsSubmitting(true);
		try {
			await submitCreateEntity({ campaignSlug, entityType: "locations", payload, onCreate: onCreate ?? undefined, dispatch });
			setIsOpen(false);
		} catch (error) {
			console.error("Failed to create location from modal", error);
			dispatch(alert({ title: lang.t("Error"), message: lang.t("Failed to create entity.") }));
		} finally {
			setIsSubmitting(false);
		}
	};
	return (
		<>
			<Button variant={buttonVariant} size={buttonSize} onClick={openModal} className={buttonClassName} icon={icon}>{buttonLabel || title}</Button>
			{isOpen && (
				<Modal title={title} type="confirm" className="CreateLocationModal" showFooter={false} onConfirm={closeModal} onCancel={closeModal}>
					<div className="CreateCharacterModal">
						<LocationCard location={draft} onChange={(_id, updated) => setDraft(updated)} onDelete={() => {}} onToggleCollapse={null} campaignSlug={campaignSlug} viewMode="modal" showDeleteButton={false} showHeader={false} />
						<div className="CreateCharacterModal__actions">
							<Button variant="primary" onClick={() => { void handleSubmit(); }} disabled={isSubmitting || !isLocationDraftValid(draft)}>{lang.t("Create")}</Button>
							<Button variant="ghost" onClick={closeModal} disabled={isSubmitting}>{lang.t("Cancel")}</Button>
						</div>
					</div>
				</Modal>
			)}
		</>
	);
}
