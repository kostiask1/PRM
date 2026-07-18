import type { ChangeEvent, RefObject } from "react";

import { lang } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";

interface SidebarArchiveControlsProps {
	fileInputRef: RefObject<HTMLInputElement>;
	onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onExport: () => void;
	onImport: () => void;
}

export default function SidebarArchiveControls({
	fileInputRef,
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
				<Button
					variant="footer"
					icon="database"
					iconSize={16}
					onClick={onExport}
				>
					{lang.t("Backup")}
				</Button>
				<Button
					variant="footer"
					icon="restore"
					iconSize={16}
					onClick={onImport}
				>
					{lang.t("Import DB")}
				</Button>
			</div>
		</div>
	);
}
