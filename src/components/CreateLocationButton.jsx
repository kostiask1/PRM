import { useState } from "react";

import { alert } from "../shared/model/index.js";
import { LocationCardView as LocationCard } from "../entities/campaign/ui.js";
import { ImageAssetField } from "../features/images/index.js";
import { useAppDispatch, useAppSelector } from "../shared/lib/index.js";
import { lang } from "../shared/config/index.js";
import Button from "./form/Button";
import Modal from "./common/Modal";
import {
	buildCreateEntityPayload,
	submitCreateEntity,
} from "../utils/createEntityButtonUtils.js";
import "../assets/components/CreateCharacterButton.css";

function createEmptyDraft() {
	const now = Date.now();
	return {
		id: `new-locations-${now}`,
		name: "",
		description: "",
		notes: [{ id: now + 1, title: "", text: "", collapsed: false }],
		imageUrl: null,
		collapsed: false,
		isNotesCollapsed: false,
	};
}

export default function CreateLocationButton({
	campaignSlug,
	buttonLabel,
	buttonVariant = "primary",
	buttonSize = Button.SIZES.SMALL,
	buttonClassName,
	icon = "plus",
	strokeWidth = 2.5,
	onCreate = null,
}) {
	const dispatch = useAppDispatch();
	const simplifiedNotesEnabled = useAppSelector(
		(state) => state.ui.simplifiedNotes,
	);
	const [isOpen, setIsOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [draft, setDraft] = useState(() => createEmptyDraft());

	const openModal = () => {
		setDraft(createEmptyDraft());
		setIsOpen(true);
	};

	const closeModal = () => {
		if (isSubmitting) return;
		setIsOpen(false);
	};

	const handleSubmit = async () => {
		if (!draft.name?.trim()) {
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Name is required to create an entry."),
				}),
			);
			return;
		}

		const payload = buildCreateEntityPayload(
			{
				name: "",
				description: "",
				notes: [],
				imageUrl: null,
				collapsed: false,
				isNotesCollapsed: false,
			},
			draft,
		);

		setIsSubmitting(true);
		try {
			await submitCreateEntity({
				campaignSlug,
				entityType: "locations",
				payload,
				onCreate,
				dispatch,
			});
			setIsOpen(false);
		} catch (error) {
			console.error("Failed to create location from modal", error);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to create entity."),
				}),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<Button
				variant={buttonVariant}
				size={buttonSize}
				onClick={openModal}
				className={buttonClassName}
				icon={icon}
				strokeWidth={strokeWidth}
			>
				{buttonLabel || lang.t("New location/faction")}
			</Button>

			{isOpen && (
				<Modal
					title={lang.t("New location/faction")}
					type="confirm"
					className="CreateLocationModal"
					showFooter={false}
					onConfirm={closeModal}
					onCancel={closeModal}
				>
					<div className="CreateCharacterModal">
						<LocationCard
							location={draft}
							onChange={(_id, updated) => setDraft(updated)}
							onDelete={() => {}}
							onToggleCollapse={null}
							campaignSlug={campaignSlug}
							viewMode="modal"
							showDeleteButton={false}
							showHeader={false}
							ImageAssetFieldComponent={ImageAssetField}
							simplifiedNotesEnabled={simplifiedNotesEnabled}
						/>
						<div className="CreateCharacterModal__actions">
							<Button
								variant="primary"
								onClick={handleSubmit}
								disabled={isSubmitting || !draft.name?.trim()}
							>
								{lang.t("Create")}
							</Button>
							<Button
								variant="ghost"
								onClick={closeModal}
								disabled={isSubmitting}
							>
								{lang.t("Cancel")}
							</Button>
						</div>
					</div>
				</Modal>
			)}
		</>
	);
}
