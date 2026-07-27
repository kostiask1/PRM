import { useState } from "react";

import { alert } from "../shared/model/index.js";
import { CharacterCardView as CharacterCard } from "../entities/campaign/ui.js";
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

function createEmptyDraft(entityType) {
	const now = Date.now();
	return {
		id: `new-${entityType}-${now}`,
		firstName: "",
		lastName: "",
		race: "",
		class: "",
		level: 1,
		motivation: "",
		description: "",
		trait: "",
		notes: [{ id: now + 1, title: "", text: "", collapsed: false }],
		collapsed: false,
		isNotesCollapsed: false,
	};
}

export default function CreateCharacterButton({
	campaignSlug,
	entityType = "characters",
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
	const [draft, setDraft] = useState(() => createEmptyDraft(entityType));

	const uiText =
		entityType === "npc"
			? {
					button: lang.t("New NPC"),
					title: lang.t("New NPC"),
				}
			: {
					button: lang.t("New character"),
					title: lang.t("New character"),
				};

	const openModal = () => {
		setDraft(createEmptyDraft(entityType));
		setIsOpen(true);
	};

	const closeModal = () => {
		if (isSubmitting) return;
		setIsOpen(false);
	};

	const handleSubmit = async () => {
		if (!draft.firstName?.trim()) {
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
				firstName: "",
				lastName: "",
				race: "",
				class: "",
				level: 1,
				motivation: "",
				description: "",
				trait: "",
				notes: [],
				collapsed: false,
				isNotesCollapsed: false,
			},
			draft,
		);

		setIsSubmitting(true);
		try {
			await submitCreateEntity({
				campaignSlug,
				entityType,
				payload,
				onCreate,
				dispatch,
			});
			setIsOpen(false);
		} catch (error) {
			console.error("Failed to create entity from modal", error);
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
				{buttonLabel || uiText.button}
			</Button>

			{isOpen && (
				<Modal
					title={uiText.title}
					type="confirm"
					showFooter={false}
					onConfirm={closeModal}
					onCancel={closeModal}
				>
					<div className="CreateCharacterModal">
						<CharacterCard
							character={draft}
							onChange={(_id, updated) => setDraft(updated)}
							onDelete={() => {}}
							onToggleCollapse={null}
							campaignSlug={campaignSlug}
							type={entityType}
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
								disabled={isSubmitting || !draft.firstName?.trim()}
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
