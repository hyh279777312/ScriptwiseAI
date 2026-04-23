import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to list workflows in WorkFlowSample folder
  app.get("/api/workflows", (req, res) => {
    const dirPath = path.join(process.cwd(), "WorkFlowSample");
    if (!fs.existsSync(dirPath)) {
      return res.json([]);
    }

    try {
      const files = fs.readdirSync(dirPath);
      const workflows = files
        .filter((file) => file.endsWith(".json"))
        .map((file) => {
          const content = fs.readFileSync(path.join(dirPath, file), "utf-8");
          return {
            filename: file,
            content: JSON.parse(content),
          };
        });
      res.json(workflows);
    } catch (err) {
      console.error("Error reading WorkFlowSample:", err);
      res.status(500).json({ error: "Failed to read workflows" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
