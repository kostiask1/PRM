import type { ChangeEvent, RefObject } from "react";

import { lang } from "../../../shared/lib/index.js";
import { Button, Tooltip } from "../../../shared/ui/index.js";
import { SIDEBAR_SHORTCUT_LABELS } from "../model/sidebar.ts";

interface SidebarArchiveControlsProps {
	fileInputRef: RefObject<HTMLInputElement>;
	isExporting: boolean;
	onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onExport: () => void;
	onImport: () => void;
}

export default function SidebarArchiveControls({
	fileInputRef,
	isExporting,
	onFileChange,
	onExport,
	onImport,
}: SidebarArchiveControlsProps) {
	return (
		<div className="Sidebar__footer">
			<input
				type="file"
				ref={fileInputRef}
				style={{ display: "none" }}
				accept=".json,.gz,.prma,.prma.gz"
				onChange={onFileChange}
			/>
			<div className="Sidebar__footerGrid">
				<Tooltip delay={1200} content={SIDEBAR_SHORTCUT_LABELS.exportData}>
					<Button
						variant="footer"
						icon={isExporting ? undefined : "export"}
						iconSize={16}
						onClick={onExport}
						disabled={isExporting}
						aria-busy={isExporting}
					>
						{isExporting && (
							<span className="Sidebar__backupLoader" aria-hidden="true" />
						)}
						{isExporting ? lang.t("Loading...") : lang.t("Export data")}
					</Button>
				</Tooltip>
				<Tooltip delay={1200} content={SIDEBAR_SHORTCUT_LABELS.importData}>
					<Button
						variant="footer"
						icon="import"
						iconSize={16}
						onClick={onImport}
					>
						{lang.t("Import data")}
					</Button>
				</Tooltip>
			</div>
		</div>
	);
}
