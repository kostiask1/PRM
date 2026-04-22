import { useCallback, useMemo, useState } from "react";

import { api } from "../api";
import { parseUrl } from "../utils/navigation";
import Modal from "./Modal";
import EntityModalContent from "./modals/EntityModalContent";
import classNames from "../utils/classNames";

function findEntityByName(entities, name) {
	const searchName = String(name || "").trim().toLowerCase();
	if (!searchName) return null;

	return entities.find((entity) => {
		const first = String(entity.firstName || "").trim().toLowerCase();
		const last = String(entity.lastName || "").trim().toLowerCase();
		const full = `${first} ${last}`.trim();
		const fallback = String(entity.name || "").trim().toLowerCase();
		return (
			first === searchName ||
			last === searchName ||
			full === searchName ||
			fallback === searchName
		);
	});
}

export default function EntityLink({
	name,
	children,
	campaignSlug,
	className = "",
}) {
	const [modalState, setModalState] = useState(null);

	const resolvedCampaignSlug = useMemo(
		() => campaignSlug || parseUrl().campaign,
		[campaignSlug],
	);

	const handleCloseModal = useCallback(() => setModalState(null), []);

	const handleOpenModal = useCallback(
		async (e) => {
			e.preventDefault();
			e.stopPropagation();

			if (!resolvedCampaignSlug || !name) return;

			try {
				const [characters, npcs] = await Promise.all([
					api.getEntities(resolvedCampaignSlug, "characters"),
					api.getEntities(resolvedCampaignSlug, "npc").catch(() => []),
				]);

				const allEntities = [...characters, ...npcs];
				const found = findEntityByName(allEntities, name);
				if (!found) return;

				const type = characters.some((item) => item.id === found.id)
					? "characters"
					: "npc";

				setModalState({
					entity: found,
					type,
				});
			} catch (error) {
				console.error("Failed to open entity link modal", error);
			}
		},
		[name, resolvedCampaignSlug],
	);

	return (
		<>
			<a
				href="#"
				className={classNames("mention-link", className)}
				onClick={handleOpenModal}>
				{children || name}
			</a>
			{modalState && (
				<Modal
					title={`Персонаж: ${modalState.entity.firstName || ""} ${modalState.entity.lastName || ""}`.trim()}
					type="character"
					showFooter={false}
					onConfirm={handleCloseModal}
					onCancel={handleCloseModal}
					children={
						<EntityModalContent
							initialEntity={modalState.entity}
							campaignSlug={resolvedCampaignSlug}
							type={modalState.type}
							onClose={handleCloseModal}
						/>
					}
				/>
			)}
		</>
	);
}
