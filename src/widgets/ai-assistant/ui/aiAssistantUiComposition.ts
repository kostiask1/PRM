import {
	createAiAttachmentControlsComponent,
	createAiPromptComposerComponent,
} from "../../../features/ai/ui/index.js";
import { EditableField } from "../../../features/editor/ui/index.js";
import { ImageGallery } from "../../../features/images/index.js";

export const AiAssistantAttachmentControls =
	createAiAttachmentControlsComponent({ ImageGallery });

export const AiAssistantPromptComposer = createAiPromptComposerComponent({
	AiAttachmentControls: AiAssistantAttachmentControls,
	EditableField,
});
