require("dotenv").config({
	path: require("path").join(__dirname, "..", ".env"),
});

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs/promises");
const storage = require("./storage");
const { realtimeMiddleware, setupRealtime } = require("./realtime");

const app = express();
const PORT = process.env.PORT || 5000;
const DIST_DIR = path.join(__dirname, "..", "dist");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(realtimeMiddleware);

app.get("/api/health", async (_req, res) => {
	res.json({ ok: true });
});

app.use(require("./routes/assets"));
app.use("/api", require("./routes/backups"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api", require("./routes/images"));
app.use("/api/campaigns", require("./routes/campaigns"));
app.use(
	"/api/campaigns/:slug/sessions",
	(req, _res, next) => {
		req.campaignSlug = req.params.slug;
		next();
	},
	require("./routes/sessions"),
);
app.use("/api/bestiary", require("./routes/bestiary"));
app.use("/api/spells", require("./routes/spells"));
app.use("/api/ai", require("./routes/ai"));

app.use(express.static(DIST_DIR));

app.get("*", async (req, res, next) => {
	if (req.path.startsWith("/api/")) return next();

	try {
		await fs.access(path.join(DIST_DIR, "index.html"));
		res.sendFile(path.join(DIST_DIR, "index.html"));
	} catch {
		next();
	}
});

app.use((err, _req, res, _next) => {
	let status = err.status || 500;
	let message = err.message || "Internal server error.";
	if (err.code === "ENOENT") {
		status = 404;
		message = "Resource not found (file or folder is missing).";
	} else if (err.code === "EACCES") {
		status = 403;
		message = "Access denied. Check permissions for the data folder.";
	}
	res.status(status).json({
		error: message,
		status,
		code: err.code,
	});
});

storage
	.ensureDir(storage.CAMPAIGNS_DIR)
	.then(() => {
		const server = http.createServer(app);
		setupRealtime(server);
		server.listen(PORT, () =>
			console.log(`Server running on http://localhost:${PORT}`),
		);
	})
	.catch((error) => {
		console.error("Failed to initialize storage:", error);
		process.exit(1);
	});
