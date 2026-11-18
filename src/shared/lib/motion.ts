export type AnimationMode = "auto" | "enabled" | "disabled";

export interface MotionPreferences {
	animationMode: AnimationMode;
	isReducedMotion: boolean;
	isPowerSaving: boolean;
	shouldAnimate: boolean;
}

interface BatteryManagerTarget extends EventTarget {
	charging: boolean;
	level: number;
	addEventListener(type: string, listener: EventListener): void;
	removeEventListener(type: string, listener: EventListener): void;
}

interface NavigatorWithBattery extends Navigator {
	getBattery?: () => Promise<BatteryManagerTarget>;
	connection?: {
		saveData?: boolean;
	};
}

let currentAnimationMode: AnimationMode = "auto";
let isSystemReducedMotion = false;
let isBatteryLowDischarging = false;
let isSaveDataActive = false;
let batteryManagerRef: BatteryManagerTarget | null = null;
let mediaQueryRef: MediaQueryList | null = null;

function evaluateShouldAnimate(): boolean {
	if (currentAnimationMode === "disabled") return false;
	if (currentAnimationMode === "enabled") return true;
	return !isSystemReducedMotion && !isBatteryLowDischarging && !isSaveDataActive;
}

function syncDomAttributes(): void {
	if (typeof document === "undefined" || !document.documentElement) return;
	const shouldAnimate = evaluateShouldAnimate();

	if (shouldAnimate) {
		document.documentElement.setAttribute("data-motion", "full");
		document.documentElement.removeAttribute("data-power-save");
	} else {
		document.documentElement.setAttribute("data-motion", "reduced");
		if (isBatteryLowDischarging || isSaveDataActive || currentAnimationMode === "disabled") {
			document.documentElement.setAttribute("data-power-save", "active");
		} else {
			document.documentElement.removeAttribute("data-power-save");
		}
	}
}

export function getMotionPreferences(): MotionPreferences {
	const shouldAnimate = evaluateShouldAnimate();
	return {
		animationMode: currentAnimationMode,
		isReducedMotion: isSystemReducedMotion,
		isPowerSaving: isBatteryLowDischarging || isSaveDataActive,
		shouldAnimate,
	};
}

export function setMotionAnimationMode(mode: unknown): void {
	currentAnimationMode =
		mode === "enabled" || mode === "disabled" ? mode : "auto";
	syncDomAttributes();
}

export function initMotionSystem(initialMode: unknown = "auto"): () => void {
	if (typeof window === "undefined") {
		return () => {};
	}

	currentAnimationMode =
		initialMode === "enabled" || initialMode === "disabled" ? initialMode : "auto";

	// 1. Reduced motion media query
	if (typeof window.matchMedia === "function") {
		mediaQueryRef = window.matchMedia("(prefers-reduced-motion: reduce)");
		isSystemReducedMotion = mediaQueryRef.matches;

		const handleMotionChange = (event: MediaQueryListEvent) => {
			isSystemReducedMotion = event.matches;
			syncDomAttributes();
		};

		if (typeof mediaQueryRef.addEventListener === "function") {
			mediaQueryRef.addEventListener("change", handleMotionChange);
		} else if (typeof mediaQueryRef.addListener === "function") {
			mediaQueryRef.addListener(handleMotionChange);
		}
	}

	// 2. Network Information API (saveData)
	const nav = navigator as NavigatorWithBattery;
	isSaveDataActive = Boolean(nav.connection?.saveData);

	// 3. Battery Status API
	const handleBatteryChange = () => {
		if (!batteryManagerRef) return;
		isBatteryLowDischarging =
			!batteryManagerRef.charging && batteryManagerRef.level <= 0.2;
		syncDomAttributes();
	};

	if (typeof nav.getBattery === "function") {
		nav.getBattery()
			.then((battery) => {
				batteryManagerRef = battery;
				battery.addEventListener("chargingchange", handleBatteryChange);
				battery.addEventListener("levelchange", handleBatteryChange);
				handleBatteryChange();
			})
			.catch(() => {
				// Battery API unsupported or restricted in this context
			});
	}

	syncDomAttributes();

	return () => {
		if (mediaQueryRef && typeof mediaQueryRef.removeEventListener === "function") {
			mediaQueryRef.removeEventListener("change", syncDomAttributes);
		}
		if (batteryManagerRef) {
			batteryManagerRef.removeEventListener("chargingchange", handleBatteryChange);
			batteryManagerRef.removeEventListener("levelchange", handleBatteryChange);
			batteryManagerRef = null;
		}
	};
}
