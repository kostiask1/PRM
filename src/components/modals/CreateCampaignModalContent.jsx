import { useRef, useState } from "react";
import Button from "../form/Button";
import Input from "../form/Input";
import { lang } from "../../services/localization";

export default function CreateCampaignModalContent({
	onCreateCampaign,
	onImportCampaign,
	onClose,
}) {
	const [name, setName] = useState("");
	const fileInputRef = useRef(null);

	return (
		<div className="CreateCampaignModal">
			<label className="CreateCampaignModal__label">
				{lang.t("Campaign name")}
			</label>
			<Input
				value={name}
				onChange={(event) => setName(event.target.value)}
				placeholder={lang.t("Enter a campaign name...")}
			/>

			<div className="CreateCampaignModal__actions">
				<div className="CreateCampaignModal__import">
					<input
						ref={fileInputRef}
						type="file"
						accept=".json,.gz,.prma,.prma.gz"
						style={{ display: "none" }}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (!file) return;
							onImportCampaign(file);
							event.target.value = "";
						}}
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
					onClick={() => onCreateCampaign(name)}
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
