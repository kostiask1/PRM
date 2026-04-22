import ReactDOM from "react-dom/client";
import App from "./App";
import "./assets/scss/main.scss"; // Importing BEM styles

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
	window.addEventListener("load", async () => {
		try {
			const existingRegistration =
				await navigator.serviceWorker.getRegistration("/");
			const isSameActiveWorker =
				existingRegistration?.active?.scriptURL?.endsWith("/service-worker.js");

			if (isSameActiveWorker) {
				return;
			}

			await navigator.serviceWorker.register("/service-worker.js");
		} catch (registrationError) {
			console.log("SW registration failed: ", registrationError);
		}
	});
}
