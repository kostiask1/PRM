import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import DiceCalculator from "./components/DiceCalculator";
import MainContent from "./components/MainContent";
import MessageBox from "./components/common/MessageBox";
import Modal from "./components/common/Modal";
import Sidebar from "./components/Sidebar";
import MentionPickerModalContent from "./components/modals/MentionPickerModalContent";
import CreateCampaignModalContent from "./components/modals/CreateCampaignModalContent";
import { lang } from "./services/localization";
import {
	alert,
	closeMentionPickerAction,
	confirm,
	requestCampaignsReloadAction,
	setCampaignsAction,
} from "./actions/app";
import {
	closeActiveModal,
	navigateTo,
	openModalRequest,
	resolveModalRequest,
	syncNavigationFromUrl,
	useAppDispatch,
	useAppSelector,
} from "./store/appStore";

export default function App() {
	const dispatch = useAppDispatch();
	const [isCTRLPressed, setCTRLPressed] = useState(false);
	const modalState = useAppSelector((store) => store.modal);
	const mentionPickerRequest = useAppSelector(
		(store) => store.mentionPickerRequest,
	);
	const campaigns = useAppSelector((store) => store.campaigns.items);
	const campaignsReloadVersion = useAppSelector(
		(store) => store.campaigns.reloadVersion,
	);
	const { activeCampaignSlug } = useAppSelector((store) => store.navigation);
	const currentLanguage = useAppSelector(
		(store) => store.localization.language,
	);

	const loadCampaigns = useCallback(async () => {
		try {
			const data = await api.listCampaigns();
			dispatch(setCampaignsAction(data));
		} catch (err) {
			console.error("Failed to load campaigns", err);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to load campaigns"),
				}),
			);
		}
	}, [dispatch]);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.ctrlKey || e.metaKey) {
				setCTRLPressed(true);
			}
		};
		const handleKeyUp = (e) => {
			if (!e.ctrlKey && !e.metaKey) {
				setCTRLPressed(false);
			}
		};
		const handleMouseUp = () => setCTRLPressed(false);

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("keyup", handleKeyUp);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("keyup", handleKeyUp);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, []);

	useEffect(() => {
		syncNavigationFromUrl();
		const handlePopState = () => syncNavigationFromUrl();
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	useEffect(() => {
		loadCampaigns();
	}, [loadCampaigns, campaignsReloadVersion]);

	useEffect(() => {
		const handleMentionPicker = async () => {
			if (!mentionPickerRequest) return;
			const { select, cancel } = mentionPickerRequest;

			if (typeof select !== "function" || typeof cancel !== "function") {
				dispatch(closeMentionPickerAction());
				return;
			}

			if (!activeCampaignSlug) {
				cancel();
				dispatch(closeMentionPickerAction());
				return;
			}

			try {
				const [characters, npcs] = await Promise.all([
					api.getEntities(activeCampaignSlug, "characters"),
					api.getEntities(activeCampaignSlug, "npc").catch(() => []),
				]);

				const toEntityOption = (entity, type) => {
					const firstName = (entity.firstName || "").trim();
					const lastName = (entity.lastName || "").trim();
					const fullName = `${firstName} ${lastName}`.trim();
					const name = fullName || (entity.name || "").trim();
					if (!name) return null;

					return {
						id: entity.id || entity.slug || name,
						type,
						name,
						firstName,
						lastName,
					};
				};

				const entities = [
					...characters
						.map((entity) => toEntityOption(entity, "characters"))
						.filter(Boolean),
					...npcs
						.map((entity) => toEntityOption(entity, "npc"))
						.filter(Boolean),
				].sort((a, b) => a.name.localeCompare(b.name, "uk"));

				if (entities.length === 0) {
					cancel();
					dispatch(closeMentionPickerAction());
					return;
				}

				openModalRequest({
					title: lang.t("Choose mention"),
					type: "confirm",
					showFooter: false,
					onCancelAction: () => {
						cancel();
						dispatch(closeMentionPickerAction());
					},
					children: (
						<MentionPickerModalContent
							entities={entities}
							onSelect={(name) => {
								select(name);
								dispatch(closeMentionPickerAction());
								closeActiveModal();
							}}
							onCancel={() => {
								cancel();
								dispatch(closeMentionPickerAction());
								closeActiveModal();
							}}
						/>
					),
				});
			} catch (err) {
				console.error("Error opening mention picker:", err);
				cancel();
				dispatch(closeMentionPickerAction());
			}
		};

		handleMentionPicker();
	}, [activeCampaignSlug, dispatch, mentionPickerRequest]);

	const handleToggleCampaignStatus = async (campaign) => {
		const isCompleting = !campaign.completed;
		let completedAt = campaign.completedAt;

		if (isCompleting) {
			const now = new Date().toISOString();
			const todayLabel = new Date().toLocaleDateString();
			const prevLabel = completedAt
				? new Date(completedAt).toLocaleDateString()
				: null;

			if (completedAt && todayLabel !== prevLabel) {
				const confirmUpdate = await dispatch(
					confirm({
						title: lang.t("Update completion date"),
						message: lang.t(
							"Campaign was already completed on {date}. Update completion date to today?",
							{ date: prevLabel },
						),
					}),
				);
				if (confirmUpdate) completedAt = now;
			} else {
				completedAt = now;
			}
		}

		try {
			await api.updateCampaign(campaign.slug, {
				completed: isCompleting,
				completedAt,
			});
			dispatch(requestCampaignsReloadAction());
		} catch (err) {
			console.error("Failed to toggle campaign status", err);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to update campaign status"),
				}),
			);
		}
	};

	const activeCampaign = campaigns.find((c) => c.slug === activeCampaignSlug);

	const openCreateCampaignModal = () => {
		const handleClose = () => closeActiveModal();
		openModalRequest({
			title: lang.t("New campaign"),
			type: "confirm",
			showFooter: false,
			children: (
				<CreateCampaignModalContent
					onClose={handleClose}
					onCreateCampaign={async (name) => {
						if (!name?.trim()) return;
						try {
							const newCampaign = await api.createCampaign(name.trim());
							dispatch(requestCampaignsReloadAction());
							handleClose();
							navigateTo(newCampaign.slug);
						} catch (err) {
							dispatch(
								alert({
									title: lang.t("Error"),
									message: err.message || lang.t("Failed to create campaign"),
								}),
							);
						}
					}}
					onImportCampaign={async (file) => {
						try {
							await api.importArchive(file, "campaign");
							dispatch(requestCampaignsReloadAction());
							handleClose();
						} catch (err) {
							dispatch(
								alert({
									title: lang.t("Import error"),
									message: err.message || lang.t("Failed to import campaign"),
								}),
							);
						}
					}}
				/>
			),
		});
	};

	return (
		<div className="App" data-lang={currentLanguage}>
			<Sidebar
				className="App__sidebar"
				campaigns={campaigns}
				activeCampaignId={activeCampaignSlug}
				onSelectCampaign={(slug) =>
					navigateTo(slug, null, false, null, isCTRLPressed)
				}
				onCreateCampaign={openCreateCampaignModal}
				onToggleCampaignStatus={handleToggleCampaignStatus}
			/>
			<MainContent className="App__main" campaign={activeCampaign} />

			{modalState.config && (
				<Modal
					{...modalState.config}
					onConfirm={(value) =>
						resolveModalRequest(modalState.requestId, value)
					}
					onCancel={
						modalState.config?.isAlert
							? null
							: () => {
									modalState.config?.onCancelAction?.();
									resolveModalRequest(modalState.requestId, null);
								}
					}
				/>
			)}
			<MessageBox />
			<DiceCalculator />
		</div>
	);
}
