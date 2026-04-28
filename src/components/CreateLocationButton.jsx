import { useState } from "react";

import { alert, refreshEntitiesAction } from "../actions/app";
import { api } from "../api";
import { useAppDispatch } from "../store/appStore";
import { lang } from "../services/localization";
import Button from "./form/Button";
import Modal from "./common/Modal";
import LocationCard from "./LocationCard";
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
}) {
	const dispatch = useAppDispatch();
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

		const payload = {
			name: "",
			description: "",
			notes: [],
			imageUrl: null,
			collapsed: false,
			isNotesCollapsed: false,
			...Object.fromEntries(
				Object.entries(draft || {}).filter(([key]) => !key.startsWith("_")),
			),
		};
		delete payload.id;
		delete payload.slug;
		delete payload.createdAt;
		delete payload.updatedAt;

		setIsSubmitting(true);
		try {
			await api.createEntity(campaignSlug, "locations", payload);
			dispatch(refreshEntitiesAction());
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
							initialEditing
							showDeleteButton={false}
							showHeader={false}
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
