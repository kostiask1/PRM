import { useCallback, useMemo, type ReactNode } from "react";

import {
	ImageGalleryRuntimeProvider,
	type ImageGalleryRuntime,
} from "../../features/images/index.js";
import { alert, confirm, prompt } from "../../shared/model/index.js";
import { useAppDispatch, useAppSelector } from "../model/index.js";

export default function ImageGalleryRuntimeHost({
	children,
}: {
	children?: ReactNode;
}) {
	const dispatch = useAppDispatch();
	const useSearchDebounce = useAppSelector(
		(state) => state.ui.useSearchDebounce !== false,
	);
	const activeCampaign = useAppSelector((state) => state.active.campaign);
	const globalIgnoreSourcesList = useAppSelector(
		(state) => state.ui.ignoreSourcesList || [],
	);
	const showAlert = useCallback<ImageGalleryRuntime["showAlert"]>(
		(payload) => dispatch(alert(payload)),
		[dispatch],
	);
	const requestConfirmation = useCallback<
		ImageGalleryRuntime["requestConfirmation"]
	>(
		(payload) => dispatch(confirm(payload)),
		[dispatch],
	);
	const requestPrompt = useCallback<ImageGalleryRuntime["requestPrompt"]>(
		(payload) => dispatch(prompt(payload)),
		[dispatch],
	);
	const runtime = useMemo<ImageGalleryRuntime>(
		() => ({
			activeCampaign: activeCampaign as ImageGalleryRuntime["activeCampaign"],
			globalIgnoreSourcesList,
			requestConfirmation,
			requestPrompt,
			showAlert,
			useSearchDebounce,
		}),
		[
			activeCampaign,
			globalIgnoreSourcesList,
			requestConfirmation,
			requestPrompt,
			showAlert,
			useSearchDebounce,
		],
	);

	return (
		<ImageGalleryRuntimeProvider runtime={runtime}>
			{children}
		</ImageGalleryRuntimeProvider>
	);
}
