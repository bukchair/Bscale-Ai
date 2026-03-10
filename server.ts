import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // WooCommerce Proxy Endpoint
  app.post("/api/proxy/woocommerce", express.json(), async (req, res) => {
    const { url, key, secret, endpoint } = req.body;

    if (!url || !key || !secret) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    try {
      const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
      const apiUrl = `${baseUrl}/wp-json/wc/v3/${endpoint || 'system_status'}`;
      const auth = Buffer.from(`${key}:${secret}`).toString('base64');

      console.log(`Proxying request to: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'User-Agent': 'BScale-AI-Proxy/1.0'
        }
      });

      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.warn("Received non-JSON response from WooCommerce:", text.substring(0, 200));
        return res.status(response.status).json({ 
          message: `The server returned a non-JSON response (${response.status}). This often happens if the URL is incorrect or a security plugin is blocking the request.`,
          debug: text.substring(0, 100)
        });
      }
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error) {
      console.error("Proxy Error:", error);
      res.status(500).json({ message: "Failed to connect to WooCommerce store. Please check the URL and ensure it's accessible." });
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
    // Serve static files from the 'dist' directory in production
    app.use(express.static(path.join(__dirname, "dist")));
    
    // Handle SPA routing: serve index.html for any unknown paths
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
