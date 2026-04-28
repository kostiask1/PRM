import { useCallback, useMemo, useState } from "react";

import { api } from "../../api";
import { parseUrl } from "../../utils/navigation";
import Modal from "./Modal";
import EntityModalContent from "../modals/EntityModalContent";
import classNames from "../../utils/classNames";
import { lang } from "../../services/localization";

function findEntityByName(entities, name) {
	const searchName = String(name || "")
		.trim()
		.toLowerCase();
	if (!searchName) return null;

	return entities.find(({ entity }) => {
		const first = String(entity.firstName || "")
			.trim()
			.toLowerCase();
		const last = String(entity.lastName || "")
			.trim()
			.toLowerCase();
		const full = `${first} ${last}`.trim();
		const fallback = String(entity.name || entity.title || "")
			.trim()
			.toLowerCase();
		return (
			first === searchName ||
			last === searchName ||
			full === searchName ||
			fallback === searchName
		);
	});
}

function getEntityDisplayName(entity, type) {
	if (type === "locations") {
		return String(entity.name || entity.title || "").trim();
	}
	return (
		`${entity.firstName || ""} ${entity.lastName || ""}`.trim() ||
		String(entity.name || entity.title || "").trim()
	);
}

export default function EntityLink({
	name,
	children,
	className = "",
}) {
	const [modalState, setModalState] = useState(null);

	const resolvedCampaignSlug = useMemo(
		() => parseUrl().campaign,
		[],
	);

	const handleCloseModal = useCallback(() => setModalState(null), []);

	const handleOpenModal = useCallback(
		async (e) => {
			e.preventDefault();
			e.stopPropagation();

			if (!resolvedCampaignSlug || !name) return;

			try {
				const [characters, npcs, locations] = await Promise.all([
					api.getEntities(resolvedCampaignSlug, "characters"),
					api.getEntities(resolvedCampaignSlug, "npc").catch(() => []),
					api.getEntities(resolvedCampaignSlug, "locations").catch(() => []),
				]);

				const allEntities = [
					...characters.map((entity) => ({ entity, type: "characters" })),
					...npcs.map((entity) => ({ entity, type: "npc" })),
					...locations.map((entity) => ({ entity, type: "locations" })),
				];
				const found = findEntityByName(allEntities, name);
				if (!found) return;

				setModalState({
					entity: found.entity,
					type: found.type,
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
				onClick={handleOpenModal}
			>
				{children || name}
			</a>
			{modalState && (
				<Modal
					title={lang
						.t("{type}: {name}", {
							type:
								modalState.type === "locations"
									? lang.t("Location/Faction")
									: modalState.type === "npc"
										? "NPC"
										: lang.t("Character"),
							name: getEntityDisplayName(
								modalState.entity,
								modalState.type,
							),
						})
						.trim()}
					type={modalState.type === "locations" ? "location" : "character"}
					className={
						modalState.type === "locations" ? "EntityLinkModal--location" : ""
					}
					showFooter={false}
					onConfirm={handleCloseModal}
					onCancel={handleCloseModal}
				>
					<EntityModalContent
						initialEntity={modalState.entity}
						campaignSlug={resolvedCampaignSlug}
						type={modalState.type}
						onClose={handleCloseModal}
					/>
				</Modal>
			)}
		</>
	);
}
