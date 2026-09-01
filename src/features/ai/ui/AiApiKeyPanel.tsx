import type { ChangeEvent, KeyboardEvent } from "react";

import { lang } from "../../../shared/lib/index.js";
import { Button, TextInput } from "../../../shared/ui/index.js";
import {
	isAiApiKeySaveDisabled,
	shouldSubmitAiApiKey,
} from "./presentationModel.ts";

export interface AiApiKeyPanelProps {
	apiKeyInput: string;
	isSavingApiKey: boolean;
	loading: boolean;
	onApiKeyChange: (value: string) => void;
	onSave: () => void;
}

export default function AiApiKeyPanel({
	apiKeyInput,
	isSavingApiKey,
	loading,
	onApiKeyChange,
	onSave,
}: AiApiKeyPanelProps) {
	const disabled = isSavingApiKey || loading;

	return (
		<div className="AiAssistantPanel__api_key_panel">
			<div className="AiAssistantPanel__api_key_title">
				{lang.t("Gemini AI setup")}
			</div>
			<div className="AiAssistantPanel__api_key_help">
				{lang.t(
					"Paste Gemini API key and it will be saved to the project .env file.",
				)}
			</div>
			<div className="AiAssistantPanel__api_key_row">
				<TextInput
					type="password"
					value={apiKeyInput}
					placeholder={lang.t("Gemini API key")}
					onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
						onApiKeyChange(event.target.value)
					}
					onKeyDown={(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
						if (shouldSubmitAiApiKey(event.key)) onSave();
					}}
					disabled={disabled}
				/>
				<Button
					variant="primary"
					icon="check"
					onClick={onSave}
					disabled={isAiApiKeySaveDisabled(
						apiKeyInput,
						isSavingApiKey,
						loading,
					)}
				>
					{isSavingApiKey ? lang.t("Saving...") : lang.t("Save")}
				</Button>
			</div>
		</div>
	);
}
