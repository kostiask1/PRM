import ReactDOM from "react-dom/client";
import App from "./App";
import { lang } from "./services/localization";
import { openModalRequest } from "./store/appStore";
import "./assets/scss/main.scss"; // Importing BEM styles

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

const SERVICE_WORKER_PATH = "/service-worker.js";
let isUpdateModalOpen = false;
let isWaitingForUpdateReload = false;
let hasReloadedForUpdate = false;

function reloadForUpdate() {
	if (hasReloadedForUpdate) return;
	hasReloadedForUpdate = true;
	window.location.reload();
}

async function clearWindowCaches() {
	if (!("caches" in window)) return;
	const cacheNames = await caches.keys();
	await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
}

async function applyServiceWorkerUpdate(registration) {
	const waitingWorker = registration?.waiting;

	if (waitingWorker) {
		isWaitingForUpdateReload = true;
		waitingWorker.postMessage({ type: "CLEAR_CACHES_AND_SKIP_WAITING" });
		window.setTimeout(reloadForUpdate, 1500);
		return;
	}

	await clearWindowCaches();
	reloadForUpdate();
}

function showServiceWorkerUpdateModal(registration) {
	if (isUpdateModalOpen || hasReloadedForUpdate) return;
	isUpdateModalOpen = true;

	openModalRequest({
		title: lang.t("Update available"),
		message: lang.t("A new version is available. Update the page now?"),
		type: "confirm",
		confirmLabel: lang.t("Update"),
		onCancelAction: () => {
			isUpdateModalOpen = false;
		},
	})
		.then((shouldUpdate) => {
			isUpdateModalOpen = false;
			if (shouldUpdate) {
				applyServiceWorkerUpdate(registration);
			}
		})
		.catch((error) => {
			isUpdateModalOpen = false;
			console.error("SW update modal failed: ", error);
		});
}

function watchServiceWorkerRegistration(registration) {
	if (registration.waiting && navigator.serviceWorker.controller) {
		showServiceWorkerUpdateModal(registration);
	}

	registration.addEventListener("updatefound", () => {
		const installingWorker = registration.installing;
		if (!installingWorker) return;

		installingWorker.addEventListener("statechange", () => {
			if (
				installingWorker.state === "installed" &&
				navigator.serviceWorker.controller
			) {
				showServiceWorkerUpdateModal(registration);
			}
		});
	});
}

if ("serviceWorker" in navigator) {
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		if (isWaitingForUpdateReload) {
			reloadForUpdate();
		}
	});

	window.addEventListener("load", async () => {
		try {
			const registration =
				await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
			watchServiceWorkerRegistration(registration);
			registration.update();
		} catch (registrationError) {
			console.log("SW registration failed: ", registrationError);
		}
	});
}
