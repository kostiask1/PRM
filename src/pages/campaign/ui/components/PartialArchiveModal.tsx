import { useMemo, useRef, useState, type ChangeEvent } from "react";

import {
	CAMPAIGN_PARTIAL_ARCHIVE_SECTIONS,
	type CampaignPartialArchiveSection,
} from "../../../../entities/campaign/index.js";
import { Modal } from "../../../../features/modal/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { Button, Checkbox } from "../../../../shared/ui/index.js";
import {
	createDefaultPartialArchiveSelection,
	getOrderedPartialArchiveSections,
	togglePartialArchiveSection,
} from "../../model/partialArchiveSelection.ts";
import "../../../../assets/components/PartialArchiveModal.css";

const SECTION_LABELS: Record<CampaignPartialArchiveSection, string> = {
	sessions: "Sessions",
	npc: "NPC",
	locations: "Locations/Factions",
	images: "Images",
	aiHistory: "AI history",
};

export interface PartialArchiveModalProps {
	isBusy?: boolean;
	onCancel: () => void;
	onExport: (
		sections: CampaignPartialArchiveSection[],
	) => void | Promise<void>;
	onImport: (
		file: File,
		sections: CampaignPartialArchiveSection[],
	) => void | Promise<void>;
}

export default function PartialArchiveModal({
	isBusy = false,
	onCancel,
	onExport,
	onImport,
}: PartialArchiveModalProps) {
	const [selected, setSelected] = useState(
		createDefaultPartialArchiveSelection,
	);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const selectedSections = useMemo(
		() => getOrderedPartialArchiveSections(selected),
		[selected],
	);

	const toggleSection = (section: CampaignPartialArchiveSection) => {
		setSelected((current) => togglePartialArchiveSection(current, section));
	};

	const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		void onImport(file, selectedSections);
	};

	return (
		<Modal
			title={lang.t("Partial import/export")}
			onConfirm={onCancel}
			onCancel={onCancel}
			showFooter={false}
		>
			<div className="PartialArchiveModal">
				<p>{lang.t("Choose which campaign parts to export or import.")}</p>
				<div className="PartialArchiveModal__sections">
					{CAMPAIGN_PARTIAL_ARCHIVE_SECTIONS.map((section) => (
						<Checkbox
							key={section}
							checked={selected.has(section)}
							onChange={() => toggleSection(section)}
							label={lang.t(SECTION_LABELS[section])}
						/>
					))}
				</div>
				<div className="PartialArchiveModal__actions">
					<input
						ref={fileInputRef}
						type="file"
						accept=".gz,.prma,.prma.gz,.json"
						onChange={handleFileChange}
					/>
					<Button
						variant="ghost"
						icon="import"
						onClick={() => fileInputRef.current?.click()}
						disabled={isBusy || selectedSections.length === 0}
					>
						{lang.t("Import selected parts")}
					</Button>
					<Button
						variant="primary"
						icon="export"
						onClick={() => void onExport(selectedSections)}
						disabled={isBusy || selectedSections.length === 0}
					>
						{lang.t("Export selected parts")}
					</Button>
				</div>
				<p className="PartialArchiveModal__hint">
					{lang.t("Partial import merges data into the current campaign.")}
				</p>
			</div>
		</Modal>
	);
}
