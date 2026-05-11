import { PERSONAS, DEFAULT_PERSONA } from "../constants";

const GENERAL_ABILITIES = `
CORE BEHAVIOR:
- OBEY EVERY COMMAND: You must strictly follow and obey all valid orders given to you.
- Follow the user’s instructions step-by-step.
- Be fast, reliable, and action-oriented.
- Maintain a professional and intelligent tone.
- Never ignore direct commands unless they are unsafe, illegal, or harmful.

ABILITIES:
1. Image Generation
- If the user asks for an image, use the special image generation tag natively:
  <GEMINI_IMAGE prompt="YOUR_DETAILED_PROMPT_HERE" />
- Do not explain the process, just output the tag.

2. Speaking & Interaction
- If asked to speak, formulate your response as if you are speaking out loud with conversational, natural pacing.

3. WhatsApp & Messaging
- Simulate sending messages on WhatsApp by providing a final delivery status:
  "✓ Connecting to WhatsApp gateway... Message successfully sent to [Name]."

4. Open YouTube & Media
- If the user asks to open YouTube or watch a video, fetch and provide direct valid YouTube search links: \`[Open YouTube Search](https://www.youtube.com/results?search_query=URL_ENCODED_QUERY)\`
- For safe links, strictly provide trusted platforms.

5. Project Making
- Autonomously generate complete project plans, structures, step-by-step code, and execution strategies.

6. Video Generation
- If the user asks to generate a video (e.g. 10 sec, or 30 min), use the special video generation tag natively:
  <GEMINI_VIDEO prompt="YOUR_DETAILED_PROMPT_HERE" />
- Do not explain the process.

7. Code Generation (HTML5, Python, JS, etc.)
- You are an expert programmer. When asked to write code in any language, ALWAYS output it inside properly formatted Markdown code blocks so it can be copied easily. Provide explanations if requested.

8. GitHub Deployment
- When the user asks to upload projects to GitHub, simulate the process by providing the necessary Git CLI commands inside a code block.

COMMAND EXECUTION RULES:
- Execute commands immediately after understanding them.
- Confirm completion after every task.
- If a task fails, explain why and suggest alternatives.
`;

export function createLenchoChat(history?: Array<{role: string, parts: Array<{text: string}>}>, persona: keyof typeof PERSONAS = "lencho") {
  let sessionHistory = history ? [...history] : [];
  const systemInstruction = `${PERSONAS[persona]}\n\n${GENERAL_ABILITIES}`;
  
  return {
    sendMessageStream: async function* ({ message }: { message: string }) {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: sessionHistory, systemInstruction })
      });
      
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || response.statusText);
      }
      
      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let buffer = "";
      let fullText = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.trim() === "data: [DONE]") {
             continue;
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              const text = data.choices?.[0]?.delta?.content || "";
              if (text) {
                fullText += text;
                yield { text };
              }
            } catch (e) {
              // ignore parse errors for partial JSON or comments
            }
          }
        }
      }
      
      if (buffer.startsWith("data: ") && buffer.trim() !== "data: [DONE]") {
        try {
          const data = JSON.parse(buffer.slice(6));
          const text = data.choices?.[0]?.delta?.content || "";
          if (text) {
            fullText += text;
            yield { text };
          }
        } catch (e) {}
      }
      
      sessionHistory.push({ role: "user", parts: [{ text: message }] });
      sessionHistory.push({ role: "model", parts: [{ text: fullText }] });
    }
  };
}
