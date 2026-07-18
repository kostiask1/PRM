import { useRef, useState, type ChangeEvent } from "react";
import { lang } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import { Input } from "../../editor/ui/index.js";

export interface CreateCampaignModalContentProps {
	onCreateCampaign: (name: string) => void | Promise<void>;
	onImportCampaign: (file: File) => void | Promise<void>;
	onClose: () => void;
}

export default function CreateCampaignModalContent({
	onCreateCampaign,
	onImportCampaign,
	onClose,
}: CreateCampaignModalContentProps) {
	const [name, setName] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		void onImportCampaign(file);
		event.target.value = "";
	};

	return (
		<div className="CreateCampaignModal">
			<label className="CreateCampaignModal__label">
				{lang.t("Campaign name")}
			</label>
			<Input
				value={name}
				onChange={(event: ChangeEvent<HTMLInputElement>) =>
					setName(event.target.value)
				}
				placeholder={lang.t("Enter a campaign name...")}
			/>

			<div className="CreateCampaignModal__actions">
				<div className="CreateCampaignModal__import">
					<input
						ref={fileInputRef}
						type="file"
						accept=".json,.gz,.prma,.prma.gz"
						style={{ display: "none" }}
						onChange={handleImport}
					/>
					<Button
						variant="footer"
						icon="import"
						onClick={() => fileInputRef.current?.click()}
					>
						{lang.t("Import campaign")}
					</Button>
				</div>
				<Button
					variant="primary"
					onClick={() => void onCreateCampaign(name)}
					disabled={!name.trim()}
				>
					{lang.t("Create")}
				</Button>
				<Button variant="ghost" onClick={onClose}>
					{lang.t("Cancel")}
				</Button>
			</div>
		</div>
	);
}
