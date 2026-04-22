import { useRef, useState } from "react";
import Button from "../form/Button";
import Input from "../form/Input";

export default function CreateCampaignModalContent({
	onCreateCampaign,
	onImportCampaign,
	onClose,
}) {
	const [name, setName] = useState("");
	const fileInputRef = useRef(null);

	return (
		<div className="CreateCampaignModal">
			<label className="CreateCampaignModal__label">Назва кампанії</label>
			<Input
				value={name}
				onChange={(event) => setName(event.target.value)}
				placeholder="Введіть назву кампанії..."
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
						onClick={() => fileInputRef.current?.click()}>
						Імпорт кампанії
					</Button>
				</div>
				<Button
					variant="primary"
					onClick={() => onCreateCampaign(name)}
					disabled={!name.trim()}>
					Створити
				</Button>
				<Button variant="ghost" onClick={onClose}>
					Скасувати
				</Button>
			</div>
		</div>
	);
}
