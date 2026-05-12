import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY || "",
    apiVersion: "v1alpha" 
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, systemInstruction } = req.body;
      
      const contents = [
        ...(history || []).map((msg: any) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: msg.parts
        })),
        { role: "user", parts: [{ text: message }] }
      ];

      const result = await ai.models.generateContentStream({
        model: "gemini-2.0-flash-exp",
        systemInstruction: systemInstruction,
        contents: contents,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          // Format as OpenAI-like SSE for the frontend to consume easily if it expects it
          // OR just send it as raw data. 
          // Looking at src/services/ai.ts, it expects data: {"choices": [{"delta": {"content": "..."}}]}
          const sseData = {
            choices: [
              {
                delta: {
                  content: text
                }
              }
            ]
          };
          res.write(`data: ${JSON.stringify(sseData)}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();

    } catch (err: any) {
      console.error("Chat error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Failed to communicate with Gemini" });
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
