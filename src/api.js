import { httpClient } from "./shared/api/httpClient.js";
import { campaignApi } from "./entities/campaign/index.js";
import { sessionApi } from "./entities/session/index.js";
import { bestiaryApi } from "./entities/bestiary/index.js";
import { spellApi } from "./entities/spell/index.js";
import { aiApi } from "./features/ai/index.js";
import { backupApi } from "./features/backup/index.js";
import { imageApi } from "./features/images/index.js";
import { settingsApi } from "./features/settings/index.js";

// Transitional compatibility facade. New code imports its owning domain client.
export const api = {
	...httpClient,
	...campaignApi,
	...sessionApi,
	...aiApi,
	...bestiaryApi,
	...spellApi,
	...imageApi,
	...backupApi,
	...settingsApi,
};
