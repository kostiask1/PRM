import { useCallback, type ReactNode } from "react";
import { lang } from "../../../shared/lib/index.js";
import CreateCampaignModalContent from "../ui/CreateCampaignModalContent.tsx";
import {
	executeCampaignArchiveImport,
	executeCampaignCreation,
	type CampaignCreationCommands,
	type CampaignCreationError,
	type CampaignCreationResult,
} from "./campaignCreation.ts";

export interface CampaignCreationModalConfig {
	title: string;
	type: "confirm";
	showFooter: false;
	children: ReactNode;
}

export interface CampaignCreationModalRuntime {
	openModal: (config: CampaignCreationModalConfig) => unknown;
	closeModal: () => void;
	createCampaign: (
		name: string,
	) => Promise<CampaignCreationResult | null | undefined>;
	importCampaign: (file: File) => Promise<unknown>;
	requestCampaignsReload: () => void;
	navigateToCampaign: (slug: string) => void;
	reportError: (error: CampaignCreationError) => void;
}

function getCampaignCreationErrorMessage(
	error: unknown,
	fallback: string,
): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

export function useCampaignCreationModal({
	openModal,
	closeModal,
	createCampaign,
	importCampaign,
	requestCampaignsReload,
	navigateToCampaign,
	reportError,
}: CampaignCreationModalRuntime): () => void {
	return useCallback(() => {
		const handleClose = () => closeModal();
		const commands = {
			createCampaign,
			importCampaign,
			requestCampaignsReload,
			closeModal: handleClose,
			navigateToCampaign,
			reportError,
			getCreateError: (error) => ({
				title: lang.t("Error"),
				message: getCampaignCreationErrorMessage(
					error,
					lang.t("Failed to create campaign"),
				),
			}),
			getImportError: (error) => ({
				title: lang.t("Import error"),
				message: getCampaignCreationErrorMessage(
					error,
					lang.t("Failed to import campaign"),
				),
			}),
		} satisfies CampaignCreationCommands;
		openModal({
			title: lang.t("New campaign"),
			type: "confirm",
			showFooter: false,
			children: (
				<CreateCampaignModalContent
					onClose={handleClose}
					onCreateCampaign={(name) =>
						executeCampaignCreation(name, commands)
					}
					onImportCampaign={(file) =>
						executeCampaignArchiveImport(file, commands)
					}
				/>
			),
		});
	}, [
		closeModal,
		createCampaign,
		importCampaign,
		navigateToCampaign,
		openModal,
		reportError,
		requestCampaignsReload,
	]);
}
