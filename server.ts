import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import "dotenv/config";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, systemInstruction } = req.body;
      
      // Convert history to OpenAI format
      const messages = [
        { role: "system", content: systemInstruction },
        ...(history || []).map((msg: any) => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.parts[0].text
        })),
        { role: "user", content: message }
      ];

      const apiKey = process.env.GROQ_API_KEY || process.env.FREE_AI_API_KEY;
      const baseURL = process.env.GROQ_API_KEY ? "https://api.groq.com/openai/v1/chat/completions" 
        : "https://free.churchless.tech/v1/chat/completions"; // Fallback URL or OpenAI free provider if needed
      
      const model = process.env.GROQ_API_KEY ? "llama-3.3-70b-versatile" : "gpt-3.5-turbo";

      const response = await fetch(baseURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      // Stream the response back to client
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      }
      res.end();

    } catch (err: any) {
      console.error("Chat error:", err);
      // Only send headers if they haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Failed to communicate with AI" });
      } else {
        res.end();
      }
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
