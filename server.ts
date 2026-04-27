import express from "express";
import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Razorpay / Payment simulation (Simulated for MVP since keys aren't provided)
  app.post("/api/payments/create-order", (req, res) => {
    const { amount } = req.body;
    res.json({
      id: `order_${Math.random().toString(36).substring(7)}`,
      amount,
      currency: "INR"
    });
  });

  // Demand Clustering Endpoint (Smart Feature)
  app.post("/api/optimize-route", (req, res) => {
    const { orders } = req.body;
    // Simple logic: sort by distance or density
    // In real app, would use Google Routes API or similar
    const optimized = orders.sort((a, b) => a.distance - b.distance);
    res.json({ route: optimized });
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
