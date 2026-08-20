import { useState } from "react";

import type { CampaignPartialArchiveSection } from "../../../../entities/campaign/index.js";
import PartialArchiveModal from "./PartialArchiveModal.tsx";

interface CampaignPartialArchiveOverlayProps {
	open: boolean;
	onClose: () => void;
	onExport: (
		sections: CampaignPartialArchiveSection[],
	) => void | Promise<void>;
	onImport: (
		file: File,
		sections: CampaignPartialArchiveSection[],
	) => void | Promise<void>;
}

export default function CampaignPartialArchiveOverlay({
	open,
	onClose,
	onExport,
	onImport,
}: CampaignPartialArchiveOverlayProps) {
	const [isBusy, setIsBusy] = useState(false);
	const exportPartialArchive = async (
		sections: CampaignPartialArchiveSection[],
	) => {
		setIsBusy(true);
		try {
			await onExport(sections);
		} finally {
			setIsBusy(false);
		}
	};
	const importPartialArchive = async (
		file: File,
		sections: CampaignPartialArchiveSection[],
	) => {
		setIsBusy(true);
		try {
			await onImport(file, sections);
			onClose();
		} finally {
			setIsBusy(false);
		}
	};

	if (!open) return null;
	return (
		<PartialArchiveModal
			isBusy={isBusy}
			onCancel={onClose}
			onExport={exportPartialArchive}
			onImport={importPartialArchive}
		/>
	);
}
