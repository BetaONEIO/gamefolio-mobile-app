import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "server", "public");
  const staticBuildPath = path.resolve(process.cwd(), "static-build");

  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  if (fs.existsSync(staticBuildPath)) {
    app.use(express.static(staticBuildPath));

    const getManifest = (platform: string) => {
      const manifestPath = path.join(staticBuildPath, platform, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      }
      return null;
    };

    app.get("/ios", (_req, res) => {
      const manifest = getManifest("ios");
      if (manifest) {
        res.set("Content-Type", "application/json").json(manifest);
      } else {
        res.status(404).json({ error: "iOS manifest not found" });
      }
    });

    app.get("/android", (_req, res) => {
      const manifest = getManifest("android");
      if (manifest) {
        res.set("Content-Type", "application/json").json(manifest);
      } else {
        res.status(404).json({ error: "Android manifest not found" });
      }
    });
  }

  app.use((_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send(`<!DOCTYPE html><html><head><title>Gamefolio</title></head><body><h1>Gamefolio API</h1><p>Scan the QR code in Expo Go to open the app.</p></body></html>`);
    }
  });
}
