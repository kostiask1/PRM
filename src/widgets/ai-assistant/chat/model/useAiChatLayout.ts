import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY_COLLAPSED = "prm_ai_chat_collapsed";
const STORAGE_KEY_MOBILE_OPEN = "prm_ai_chat_mobile_open";
const DESKTOP_MEDIA_QUERY = "(min-width: 1401px)";
const AI_CHAT_SIDEBAR_OFFSET_VAR = "--ai-chat-sidebar-offset";

export interface AiChatLayoutState {
	isDesktop: boolean;
	isCollapsed: boolean;
	isMobileOpen: boolean;
	toggleChat: () => void;
	expandDesktop: () => void;
	collapseDesktop: () => void;
	openMobile: () => void;
	closeMobile: () => void;
}

export function triggerAiChatToggle() {
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent("prm:toggle-ai-chat"));
	}
}

export function useAiChatLayout(): AiChatLayoutState {
	const [isDesktop, setIsDesktop] = useState<boolean>(() => {
		if (typeof window === "undefined") return true;
		return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
	});

	const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
		if (typeof window === "undefined") return false;
		return localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true";
	});

	const [isMobileOpen, setIsMobileOpen] = useState<boolean>(() => {
		if (typeof window === "undefined") return false;
		return localStorage.getItem(STORAGE_KEY_MOBILE_OPEN) === "true";
	});

	// Media query listener
	useEffect(() => {
		if (typeof window === "undefined") return;
		const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
		const handler = (e: MediaQueryListEvent) => {
			setIsDesktop(e.matches);
		};
		mql.addEventListener("change", handler);
		return () => mql.removeEventListener("change", handler);
	}, []);

	// Sync active desktop sidebar width to root CSS variable so fixed overlays/modals leave chat exposed
	useEffect(() => {
		if (typeof document === "undefined") return;
		const offset = isDesktop ? (isCollapsed ? "44px" : "380px") : "0px";
		document.documentElement.style.setProperty(AI_CHAT_SIDEBAR_OFFSET_VAR, offset);
		return () => {
			document.documentElement.style.removeProperty(AI_CHAT_SIDEBAR_OFFSET_VAR);
		};
	}, [isDesktop, isCollapsed]);

	// Actions with persistence
	const expandDesktop = useCallback(() => {
		setIsCollapsed(false);
		localStorage.setItem(STORAGE_KEY_COLLAPSED, "false");
	}, []);

	const collapseDesktop = useCallback(() => {
		setIsCollapsed(true);
		localStorage.setItem(STORAGE_KEY_COLLAPSED, "true");
	}, []);

	const openMobile = useCallback(() => {
		setIsMobileOpen(true);
		localStorage.setItem(STORAGE_KEY_MOBILE_OPEN, "true");
	}, []);

	const closeMobile = useCallback(() => {
		setIsMobileOpen(false);
		localStorage.setItem(STORAGE_KEY_MOBILE_OPEN, "false");
	}, []);

	const toggleChat = useCallback(() => {
		if (isDesktop) {
			setIsCollapsed((prev) => {
				const next = !prev;
				localStorage.setItem(STORAGE_KEY_COLLAPSED, String(next));
				return next;
			});
		} else {
			setIsMobileOpen((prev) => {
				const next = !prev;
				localStorage.setItem(STORAGE_KEY_MOBILE_OPEN, String(next));
				return next;
			});
		}
	}, [isDesktop]);

	// Custom DOM Event listener for toggling AI chat from any header or button
	useEffect(() => {
		const handleCustomToggle = () => {
			toggleChat();
		};
		const handlePrefillOpen = (event: Event) => {
			const detail = (event as CustomEvent<{ open?: boolean }>).detail;
			if (detail?.open === false) return;
			if (isDesktop) {
				expandDesktop();
			} else {
				openMobile();
			}
		};
		window.addEventListener("prm:toggle-ai-chat", handleCustomToggle);
		window.addEventListener("prm:ai-chat-prefill", handlePrefillOpen);
		return () => {
			window.removeEventListener("prm:toggle-ai-chat", handleCustomToggle);
			window.removeEventListener("prm:ai-chat-prefill", handlePrefillOpen);
		};
	}, [toggleChat, isDesktop, expandDesktop, openMobile]);

	// Global Keyboard Shortcut: CTRL+J / CMD+J
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			if ((event.ctrlKey || event.metaKey) && (event.key === "j" || event.key === "J" || event.code === "KeyJ")) {
				event.preventDefault();
				toggleChat();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [toggleChat]);

	return {
		isDesktop,
		isCollapsed,
		isMobileOpen,
		toggleChat,
		expandDesktop,
		collapseDesktop,
		openMobile,
		closeMobile,
	};
}
