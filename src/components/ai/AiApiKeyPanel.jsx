import Button from "../form/Button";
import Input from "../form/Input";
import { lang } from "../../services/localization";

export default function AiApiKeyPanel({
	apiKeyInput,
	isSavingApiKey,
	loading,
	onApiKeyChange,
	onSave,
}) {
	return (
		<div className="AiAssistant__api_key_panel">
			<div className="AiAssistant__api_key_title">
				{lang.t("Gemini AI setup")}
			</div>
			<div className="AiAssistant__api_key_help">
				{lang.t(
					"Paste Gemini API key and it will be saved to the project .env file.",
				)}
			</div>
			<div className="AiAssistant__api_key_row">
				<Input
					type="password"
					value={apiKeyInput}
					placeholder={lang.t("Gemini API key")}
					onChange={(event) => onApiKeyChange(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							onSave();
						}
					}}
					disabled={isSavingApiKey || loading}
				/>
				<Button
					variant="primary"
					icon="check"
					onClick={onSave}
					disabled={isSavingApiKey || loading || !apiKeyInput.trim()}
				>
					{isSavingApiKey ? lang.t("Saving...") : lang.t("Save")}
				</Button>
			</div>
		</div>
	);
}
