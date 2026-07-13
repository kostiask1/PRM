import { useMemo, useRef, useState } from "react";

import { lang } from "../../../../shared/lib/index.js";
import { Button, Checkbox } from "../../../../shared/ui/index.js";
import { Modal } from "../../../../features/modal/index.js";
import "../../../../assets/components/PartialArchiveModal.css";

const SECTION_OPTIONS = [
	{ id: "sessions", label: "Sessions" },
	{ id: "npc", label: "NPC" },
	{ id: "locations", label: "Locations/Factions" },
	{ id: "images", label: "Images" },
	{ id: "aiHistory", label: "AI history" },
];

export default function PartialArchiveModal({
	isBusy = false,
	onCancel,
	onExport,
	onImport,
}) {
	const [selected, setSelected] = useState(
		() => new Set(SECTION_OPTIONS.map((option) => option.id)),
	);
	const fileInputRef = useRef(null);
	const selectedSections = useMemo(() => [...selected], [selected]);

	const toggleSection = (sectionId) => {
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(sectionId)) next.delete(sectionId);
			else next.add(sectionId);
			return next;
		});
	};

	const handleFileChange = (event) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		onImport(file, selectedSections);
	};

	return (
		<Modal
			title={lang.t("Partial import/export")}
			onCancel={onCancel}
			showFooter={false}
		>
			<div className="PartialArchiveModal">
				<p>{lang.t("Choose which campaign parts to export or import.")}</p>
				<div className="PartialArchiveModal__sections">
					{SECTION_OPTIONS.map((option) => (
						<Checkbox
							key={option.id}
							checked={selected.has(option.id)}
							onChange={() => toggleSection(option.id)}
							label={lang.t(option.label)}
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
						onClick={() => onExport(selectedSections)}
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
