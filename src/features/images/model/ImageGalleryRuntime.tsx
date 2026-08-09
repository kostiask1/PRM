import {
	createContext,
	useContext,
	type ReactNode,
} from "react";

import type { CampaignSourceSettings } from "../../../entities/reference/index.js";

export interface ImageGalleryMessageBoxPayload extends Record<string, unknown> {
	checkboxDefaultChecked?: boolean;
	checkboxLabel?: string | null;
	defaultValue?: string;
	getConfirmValue?: (
		value: unknown,
		extractFolderContents: boolean,
	) => unknown;
	message?: string;
	title?: string;
}

export interface ImageGalleryRuntime {
	activeCampaign: CampaignSourceSettings | null;
	globalIgnoreSourcesList: string[];
	requestConfirmation(
		payload: ImageGalleryMessageBoxPayload,
	): Promise<unknown>;
	requestPrompt(payload: ImageGalleryMessageBoxPayload): Promise<unknown>;
	showAlert(payload: ImageGalleryMessageBoxPayload): Promise<unknown>;
	useSearchDebounce: boolean;
}

export interface ImageGalleryRuntimeProviderProps {
	runtime: ImageGalleryRuntime;
	children?: ReactNode;
}

const ImageGalleryRuntimeContext = createContext<ImageGalleryRuntime | null>(
	null,
);

export function ImageGalleryRuntimeProvider({
	runtime,
	children,
}: ImageGalleryRuntimeProviderProps) {
	return (
		<ImageGalleryRuntimeContext.Provider value={runtime}>
			{children}
		</ImageGalleryRuntimeContext.Provider>
	);
}

export function useImageGalleryRuntime(): ImageGalleryRuntime {
	const runtime = useContext(ImageGalleryRuntimeContext);
	if (runtime === null) {
		throw new Error(
			"ImageGalleryRuntimeProvider is required to render image controls",
		);
	}
	return runtime;
}
