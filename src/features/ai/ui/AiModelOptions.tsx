import type { ReactNode } from "react";

import { lang } from "../../../shared/lib/index.js";
import type { AiModelDescriptor } from "../api/aiApi.ts";

export default function renderAiModelOptions(
	models?: AiModelDescriptor[] | null,
): ReactNode {
	return Array.isArray(models) && models.length > 0 ? (
		models.map((model) => (
			<option key={model.name} value={model.name}>
				{model.displayName || model.name}
			</option>
		))
	) : (
		<option value="">{lang.t("Loading models...")}</option>
	);
}
