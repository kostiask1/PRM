export interface CampaignCreationResult {
	slug: string;
}

export interface CampaignCreationError {
	title: string;
	message: string;
}

export interface CampaignCreationCommands {
	createCampaign: (
		name: string,
	) => Promise<CampaignCreationResult | null | undefined>;
	importCampaign: (file: File) => Promise<unknown>;
	requestCampaignsReload: () => void;
	closeModal: () => void;
	navigateToCampaign: (slug: string) => void;
	reportError: (error: CampaignCreationError) => void;
	getCreateError: (error: unknown) => CampaignCreationError;
	getImportError: (error: unknown) => CampaignCreationError;
}

export async function executeCampaignCreation(
	name: string | null | undefined,
	commands: CampaignCreationCommands,
): Promise<void> {
	if (!name?.trim()) return;
	try {
		const newCampaign = await commands.createCampaign(name.trim());
		if (!newCampaign) {
			throw new Error("Campaign creation returned no result");
		}
		commands.requestCampaignsReload();
		commands.closeModal();
		commands.navigateToCampaign(newCampaign.slug);
	} catch (error) {
		commands.reportError(commands.getCreateError(error));
	}
}

export async function executeCampaignArchiveImport(
	file: File,
	commands: CampaignCreationCommands,
): Promise<void> {
	try {
		await commands.importCampaign(file);
		commands.requestCampaignsReload();
		commands.closeModal();
	} catch (error) {
		commands.reportError(commands.getImportError(error));
	}
}
