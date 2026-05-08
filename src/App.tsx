import { useState, useRef, useEffect } from "react";
import { Send, Terminal, Loader2, Bot, User, Command } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createLenchoChat } from "./services/ai";

type ChatRole = "user" | "model";

interface Message {
  id: string;
  role: ChatRole;
  text: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "model",
      text: "System initialized. I am Lencho, your advanced AI operating assistant. How can I execute your commands today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Keep the chat session stable
  const chatSession = useRef(createLenchoChat());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput("");
    
    // Add user message
    const userId = Date.now().toString();
    setMessages((prev) => [...prev, { id: userId, role: "user", text: userMsg }]);
    
    setIsTyping(true);
    
    // Add temporary model response
    const modelId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: modelId, role: "model", text: "" }]);

    try {
      const stream = await chatSession.current.sendMessageStream({ message: userMsg });
      
      let fullText = "";
      for await (const chunk of stream) {
        fullText += (chunk as any).text || "";
        
        // Update the last message
        setMessages((prev) => 
          prev.map((msg) => 
            msg.id === modelId ? { ...msg, text: fullText } : msg
          )
        );
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === modelId ? { ...msg, text: "Error: " + (error?.message || "Unknown error occurred") } : msg
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-[260px] bg-slate-900 text-slate-400 hidden md:flex flex-col shrink-0">
        <div className="h-16 px-6 border-b border-slate-800/50 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">
            L
          </div>
          <div>
            <h1 className="font-bold text-[18px] tracking-tight text-white">LENCHO <span className="text-slate-400 font-normal">OS</span></h1>
          </div>
        </div>
        <div className="p-4 flex-1 overflow-y-auto mt-2">
          <div className="mb-6">
            <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3 px-4">Operational Hub</h2>
            <ul className="space-y-1">
              {['Communication', 'Search & Info', 'Productivity', 'Smart Assistance'].map((ability, idx) => (
                <li key={ability} className={`flex items-center gap-3 text-sm px-4 py-3 rounded-lg cursor-default transition-colors ${idx === 0 ? 'bg-slate-700 text-white border-l-4 border-indigo-500' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-200 border-l-4 border-transparent'}`}>
                  <Command size={16} />
                  {ability}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="p-6 mt-auto">
          <div className="bg-slate-800 rounded-lg p-3 text-xs">
            <div className="mb-2 text-slate-500 font-semibold uppercase tracking-wider">System Integrity</div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="w-[98%] h-full bg-emerald-500 rounded-full"></div>
            </div>
            <div className="mt-2 text-slate-400">Version 2.4.0-Stable</div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-white border-l border-slate-200">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0 z-10 w-full">
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 px-4 py-1.5 rounded-full text-xs text-slate-500 flex items-center gap-2 font-semibold tracking-wide">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              AGENT SYSTEM ACTIVE
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-[13px] font-semibold text-slate-800">Administrator</div>
              <div className="text-[11px] text-slate-500">Standard Protocol</div>
            </div>
            <div className="w-9 h-9 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              AD
            </div>
          </div>
        </header>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto w-full bg-white relative">
          <div className="max-w-4xl mx-auto w-full p-4 md:p-6 pb-6">
            <div className="space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {/* Model Avatar */}
                  {message.role === 'model' && (
                    <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 mt-0.5 shadow-sm text-white font-bold text-sm">
                      L
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div className={`max-w-[85%] px-5 py-3.5 border text-[14px] leading-relaxed shadow-sm ${
                    message.role === 'user' 
                      ? 'bg-slate-100 border-transparent text-slate-800 rounded-2xl rounded-br-sm' 
                      : 'bg-indigo-500 border-indigo-500 text-white rounded-2xl rounded-bl-sm'
                  }`}>
                    {message.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{message.text}</div>
                    ) : (
                      <div className="markdown-body">
                        {message.text === "" && isTyping ? (
                          <div className="flex space-x-1 items-center h-4">
                            <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        ) : (
                          <Markdown remarkPlugins={[remarkGfm]}>{message.text}</Markdown>
                        )}
                      </div>
                    )}
                  </div>

                  {/* User Avatar */}
                  {message.role === 'user' && (
                    <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0 mt-0.5 flex items-center justify-center font-bold text-slate-600 text-sm shadow-sm">
                      U
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="shrink-0 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto w-full p-4 md:px-6">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <div className="absolute left-4 w-10 h-10 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 pointer-events-none">
                <Terminal size={18} />
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a command... (e.g. 'Draft an email' or 'Web search')"
                disabled={isTyping}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-16 pr-14 py-3.5 text-[14px] font-sans focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50 text-slate-800 shadow-sm"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="absolute right-2.5 p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-sm"
              >
                {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
            <div className="text-center mt-3 text-[10px] text-slate-400 font-mono tracking-wide">
              LENCHO SYSTEM EXPECTS VALID COMMANDS · SECURE ENCLAVE
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
