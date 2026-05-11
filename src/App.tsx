import { useState, useRef, useEffect } from "react";
import { Send, Terminal, Loader2, Bot, User, Command, Volume2, VolumeX, Download, Play, Mic, MicOff, Copy, Check, Pencil, Plus, MessageSquare } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createLenchoChat } from "./services/ai";
import { PERSONAS, PERSONA_COLORS } from "./constants";

type ChatRole = "user" | "model";

interface Message {
  id: string;
  role: ChatRole;
  text: string;
}

interface Project {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const [copied, setCopied] = useState(false);
  
  if (!inline) {
    return (
      <div className="relative group rounded-lg overflow-hidden my-4 border border-slate-700/40 shadow-sm bg-[#0d1117] max-w-full">
        <div className="flex justify-between items-center px-4 py-2 mt-0 bg-[#161b22] border-b border-slate-700/40">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{match ? match[1] : 'code'}</span>
          <button 
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/30 hover:bg-slate-700/80 rounded text-slate-300 transition-colors text-xs font-medium cursor-pointer"
            title="Copy code"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy Code"}
          </button>
        </div>
        <div className="p-4 overflow-x-auto text-[13px] leading-relaxed text-slate-200">
          <code className={className} {...props}>
            {children}
          </code>
        </div>
      </div>
    );
  }
  return <code className={`${className} bg-slate-200 text-slate-700 px-1.5 py-0.5 mx-0.5 rounded text-[0.9em] font-mono border border-slate-300`} {...props}>{children}</code>;
};


import { GoogleGenAI } from "@google/genai";

const GeminiVideoGenerator = ({ prompt }: { prompt: string }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(false);

  useEffect(() => {
    const checkKey = async () => {
        const canUseKey = await (window as any).aistudio.hasSelectedApiKey();
        setHasKey(canUseKey);
    };
    checkKey();
  }, []);

  const generate = async () => {
    if(!(window as any).aistudio.hasSelectedApiKey()) {
        await (window as any).aistudio.openSelectKey();
        setHasKey(true);
    }
    
    setIsGenerating(true);
    setError(null);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-lite-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '1080p',
                aspectRatio: '16:9'
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({operation: operation});
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        
        // Fetch to get authenticated download URL
        const response = await fetch(downloadLink, {
            method: 'GET',
            headers: {
              'x-goog-api-key': process.env.API_KEY || '',
            },
        });
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob));

    } catch (e: any) {
        setError(e.message);
    } finally {
        setIsGenerating(false);
    }
  };

  if(!hasKey) return <button onClick={async () => { await (window as any).aistudio.openSelectKey(); setHasKey(true); }} className="bg-indigo-600 text-white p-2 rounded text-sm">Select Gemini API Key</button>
  if (error) return <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm border border-rose-200">Error: {error}</div>;
  if (isGenerating) return <div className="p-3 bg-slate-100 rounded-lg text-slate-600 text-sm">Generating video...</div>;
  if (videoUrl) return <video src={videoUrl} controls className="w-full h-auto rounded-lg" />;
  return <button onClick={generate} className="bg-indigo-600 text-white p-2 rounded text-sm">Generate Video</button>;
};

const GeminiImageGenerator = ({ prompt, personaStyle }: { prompt: string, personaStyle: any }) => {
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&seed=${Math.floor(Math.random() * 1000)}`;
  
  const [downloading, setDownloading] = useState(false);

  const downloadImage = async () => {
    setDownloading(true);
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `image-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Failed to download image", e);
    } finally {
        setDownloading(false);
    }
  }

  return (
    <div className="space-y-2">
        <img src={imageUrl} alt={prompt} className="w-full h-auto rounded-lg" />
        <button onClick={downloadImage} className={`px-3 py-1 ${personaStyle.bg} text-white rounded text-xs`}>
            {downloading ? 'Downloading...' : 'Download Image'}
        </button>
    </div>
  );
};

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const savedProjects = localStorage.getItem("lencho_projects_v1");
      if (savedProjects) return JSON.parse(savedProjects);
      
      const saved = localStorage.getItem("lencho_chat_history_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Date.now() - parsed.timestamp < 30 * 24 * 60 * 60 * 1000) {
          return [{
            id: Date.now().toString(),
            title: "Previous Session",
            messages: parsed.messages,
            updatedAt: parsed.timestamp
          }];
        }
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
    return [{
      id: Date.now().toString(),
      title: "New Project",
      messages: [{ id: "init", role: "model", text: "System initialized. I am Lencho, your advanced AI operating assistant. My memory spans 30 days. How can I execute your commands today?" }],
      updatedAt: Date.now()
    }];
  });

  const [persona, setPersona] = useState<keyof typeof PERSONAS>("lencho");
  const [currentProjectId, setCurrentProjectId] = useState<string>(projects[0]?.id || "");
  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0];
  const messages = currentProject?.messages || [];
  
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const personaStyle = PERSONA_COLORS[persona] || PERSONA_COLORS.lencho;
  const [editInput, setEditInput] = useState("");
  
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceEnabledRef = useRef(voiceEnabled);
  const recognitionRef = useRef<any>(null);
  
  const getChatSession = (historyMessages: Message[]) => {
    const historyForModel = historyMessages
      .filter((m) => m.id !== "init" && m.text.trim())
      .map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      }));
    return createLenchoChat(historyForModel.length > 0 ? historyForModel : undefined, persona);
  };

  const chatSession = useRef<any>(null);
  
  useEffect(() => {
    chatSession.current = getChatSession(messages);
  }, [currentProjectId]);

  useEffect(() => {
    localStorage.setItem("lencho_projects_v1", JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    
    // Clean text for speech (remove markdown artifacts)
    const cleanText = text
      .replace(/!\[.*?\]\(.*?\)/g, ' [Image Generated] ')
      .replace(/\[.*?\]\(.*?\)/g, ' [Link Provided] ')
      .replace(/[*_#`~]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    // Try to find a professional/male english voice if possible
    const selectedVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('male')) 
      || voices.find(v => v.lang.startsWith('en-GB') || v.name.includes('Google UK English')) 
      || voices.find(v => v.lang.startsWith('en'));
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const handleDownloadMedia = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      // Fallback for cross-origin URLs that block fetch
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const createNewProject = () => {
    const newProj: Project = {
      id: Date.now().toString(),
      title: "New Project",
      messages: [{ id: "init", role: "model", text: "System initialized. I am Lencho, your advanced AI operating assistant. My memory spans 30 days. How can I execute your commands today?" }],
      updatedAt: Date.now()
    };
    setProjects(prev => [newProj, ...prev]);
    setCurrentProjectId(newProj.id);
  };

  const switchProject = (id: string) => {
    if (isTyping) return;
    setCurrentProjectId(id);
  };

  const processCommand = async (textToProcess: string, baseMessagesOverride?: Message[]) => {
    if (!textToProcess.trim() || isTyping) return;

    const userMsg = textToProcess.trim();
    setInput("");
    setIsTyping(true);
    
    const userId = Date.now().toString();
    const modelId = (Date.now() + 1).toString();
    
    const baseMsgs = baseMessagesOverride || messages;
    const updatedMessagesWithUser = [...baseMsgs, { id: userId, role: "user" as ChatRole, text: userMsg }];
    
    setProjects((prev) => prev.map(p => p.id === currentProjectId ? { 
      ...p, 
      messages: [...updatedMessagesWithUser, { id: modelId, role: "model" as ChatRole, text: "" }],
      updatedAt: Date.now()
    } : p));

    try {
      if (!chatSession.current) chatSession.current = getChatSession(updatedMessagesWithUser);
      const stream = await chatSession.current.sendMessageStream({ message: userMsg });
      
      let fullText = "";
      for await (const chunk of stream) {
        fullText += (chunk as any).text || "";
        
        setProjects((prev) => prev.map((p) => {
          if (p.id === currentProjectId) {
             const t = baseMsgs.length === 1 && p.title === "New Project" ? textToProcess.slice(0, 20) + "..." : p.title;
             return {
              ...p,
              title: t,
              messages: p.messages.map((msg) => msg.id === modelId ? { ...msg, text: fullText } : msg),
              updatedAt: Date.now()
             };
          }
          return p;
        }));
      }

      if (voiceEnabledRef.current) speakText(fullText);

    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMsg = "Error: " + (error?.message || "Unknown error occurred");
      setProjects((prev) => prev.map((p) => p.id === currentProjectId ? {
        ...p,
        messages: p.messages.map((msg) => msg.id === modelId ? { ...msg, text: errorMsg } : msg),
        updatedAt: Date.now()
      } : p));
      if (voiceEnabledRef.current) speakText(errorMsg);
    } finally {
      setIsTyping(false);
    }
  };

  const confirmEdit = async (msgId: string) => {
    if (!editInput.trim() || isTyping) return;
    setEditingMsgId(null);
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    const truncatedMsgs = messages.slice(0, msgIndex);
    
    setProjects(prev => prev.map(p => p.id === currentProjectId ? {
      ...p, messages: truncatedMsgs, updatedAt: Date.now()
    } : p));
    
    chatSession.current = getChatSession(truncatedMsgs);
    await processCommand(editInput, truncatedMsgs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await processCommand(input);
  };

  const playChime = (type: 'start' | 'success') => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    if (type === 'start') {
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } else {
      oscillator.frequency.setValueAtTime(660, audioCtx.currentTime); // E5
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.start(audioCtx.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
      oscillator.stop(audioCtx.currentTime + 0.2);
    }
  };

  const toggleListening = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      playChime('start');
      if (!voiceEnabled) setVoiceEnabled(true);
    };

    recognition.onresult = (event: any) => {
      playChime('success');
      const transcript = event.results[0][0].transcript;
      processCommand(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-[260px] bg-slate-900 text-slate-400 hidden md:flex flex-col shrink-0">
        <div className="h-16 px-6 border-b border-slate-800/50 flex items-center gap-3 shrink-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold ${personaStyle.bg}`}>
            L
          </div>
          <div>
            <h1 className="font-bold text-[18px] tracking-tight text-white">LENCHO <span className="text-slate-400 font-normal">OS</span></h1>
          </div>
        </div>
        <div className="p-4 flex-1 overflow-y-auto mt-2">
          <div className="mb-6 flex items-center justify-between px-4">
            <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Projects</h2>
            <button onClick={createNewProject} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-400 transition-colors" title="New Project">
              <Plus size={16} />
            </button>
          </div>
          <ul className="space-y-1">
             {[...projects].sort((a,b) => b.updatedAt - a.updatedAt).map(prevProj => (
                <li key={prevProj.id} 
                    onClick={() => switchProject(prevProj.id)}
                    className={`flex items-center gap-3 text-[13px] px-4 py-2.5 rounded-lg cursor-pointer transition-colors ${prevProj.id === currentProjectId ? 'bg-slate-700 text-white border-l-4 border-indigo-500' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-200 border-l-4 border-transparent'}`}>
                  <MessageSquare size={14} className="shrink-0" />
                  <span className="truncate">{prevProj.title}</span>
                </li>
             ))}
          </ul>
          <div className="mt-8 px-4 pt-4 border-t border-slate-800">
            <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Persona</h2>
            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value as keyof typeof PERSONAS)}
              className="w-full bg-slate-800 text-slate-200 text-sm rounded-lg p-2 border border-slate-700"
            >
              {Object.keys(PERSONAS).map((p) => (
                <option key={p} value={p}>{p.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
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
            <button
              onClick={() => {
                setVoiceEnabled(!voiceEnabled);
                if (!voiceEnabled && 'speechSynthesis' in window) {
                  const u = new SpeechSynthesisUtterance("Voice synthesis enabled.");
                  window.speechSynthesis.speak(u);
                } else if ('speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
              }}
              className={`p-2 rounded-full transition-colors ${voiceEnabled ? 'bg-indigo-100 text-indigo-600 shadow-inner' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              title={voiceEnabled ? "Disable Voice" : "Enable Voice"}
            >
              {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
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
                    <div className={`w-9 h-9 rounded-full ${personaStyle.bg} flex items-center justify-center shrink-0 mt-0.5 shadow-sm text-white font-bold text-sm`}>
                      L
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div className={`max-w-[85%] px-5 py-3.5 border text-[14px] leading-relaxed shadow-sm relative group ${
                    message.role === 'user' 
                      ? 'bg-slate-100 border-slate-200 text-slate-800 rounded-2xl rounded-br-sm' 
                      : `${personaStyle.bg} ${personaStyle.border} text-white rounded-2xl rounded-bl-sm`
                  }`}>
                    {message.role === 'user' ? (
                      editingMsgId === message.id ? (
                        <div className="flex flex-col gap-2 min-w-[200px] md:min-w-[300px]">
                          <textarea 
                            value={editInput}
                            onChange={e => setEditInput(e.target.value)}
                            className="w-full bg-white border border-slate-300 text-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                            rows={3}
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingMsgId(null)} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-600 transition-colors">Cancel</button>
                            <button onClick={() => confirmEdit(message.id)} className="px-3 py-1.5 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-medium">Submit</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="whitespace-pre-wrap pr-6">{message.text}</div>
                          <button 
                            onClick={() => { setEditingMsgId(message.id); setEditInput(message.text); }}
                            className="absolute top-2.5 right-2.5 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 shadow-sm border border-slate-200"
                            title="Edit Command"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="markdown-body">
                        {message.text === "" && isTyping ? (
                          <div className="flex space-x-1 items-center h-4">
                            <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        ) : (
                          message.text.split(/(<GEMINI_VIDEO\s+prompt="[^"]*"\s*\/>|<GEMINI_IMAGE\s+prompt="[^"]*"\s*\/>)/g).map((part, i) => {
                            if (part.startsWith('<GEMINI_VIDEO')) {
                              const promptMatch = part.match(/prompt="([^"]*)"/);
                              if (promptMatch) {
                                return <GeminiVideoGenerator key={i} prompt={promptMatch[1]} />;
                              }
                            }
                            if (part.startsWith('<GEMINI_IMAGE')) {
                              const promptMatch = part.match(/prompt="([^"]*)"/);
                              if (promptMatch) {
                                return <GeminiImageGenerator key={i} prompt={promptMatch[1]} personaStyle={personaStyle} />;
                              }
                            }
                            return (
                              <Markdown 
                                key={i}
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  img: ({node, ...props}) => (
                                    <span className="relative group inline-block max-w-full">
                                      <img 
                                        {...props} 
                                        className="max-w-full rounded-lg mt-2 mb-2 shadow-sm border border-[#ffffff10]" 
                                        referrerPolicy="no-referrer" 
                                        crossOrigin="anonymous"
                                      />
                                      <button 
                                        onClick={() => props.src && handleDownloadMedia(props.src, 'lencho-image.jpg')}
                                        className="absolute top-4 right-4 p-2 bg-slate-900/40 hover:bg-slate-900/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm z-10 flex items-center gap-2 text-xs font-semibold"
                                        title="Download Image"
                                      >
                                        <Download size={14} /> Download
                                      </button>
                                    </span>
                                  ),
                                  a: ({node, ...props}) => {
                                    const isMedia = props.href?.match(/\.(mp4|webm|ogg)$/i);
                                    if (isMedia) {
                                      return (
                                        <span className="inline-flex flex-wrap items-center gap-3 bg-indigo-600/50 px-4 py-2 mt-2 mb-2 rounded-lg border border-indigo-400 max-w-full">
                                          <Play size={16} className="text-white shrink-0" />
                                          <a {...props} className="text-white font-medium hover:underline text-sm truncate" target="_blank" rel="noopener noreferrer">
                                            {props.children}
                                          </a>
                                          <button 
                                            onClick={(e) => {
                                              e.preventDefault();
                                              if (props.href) handleDownloadMedia(props.href, 'lencho-video.mp4');
                                            }}
                                            className="ml-auto p-1.5 hover:bg-indigo-500 rounded text-indigo-100 shrink-0"
                                            title="Download Video"
                                          >
                                            <Download size={16} />
                                          </button>
                                        </span>
                                      );
                                    }
                                    return (
                                      <a {...props} className="text-indigo-200 font-semibold underline underline-offset-2 opacity-90 hover:opacity-100" target="_blank" rel="noopener noreferrer" />
                                    );
                                  },
                                  pre: ({children}) => <>{children}</>,
                                  code: CodeBlock
                                }}
                              >
                                {part}
                              </Markdown>
                            );
                          })
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
                placeholder="Type a command... (e.g. 'Generate an image', 'Find a video')"
                disabled={isTyping}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-16 pr-24 py-3.5 text-[14px] font-sans focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50 text-slate-800 shadow-sm"
              />
              <div className="absolute right-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isTyping}
                  className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                    isListening 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                  }`}
                  title={isListening ? "Listening... (Click to stop)" : "Voice Command (Oral Order)"}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className={`p-2 ${personaStyle.bg} hover:opacity-90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-sm`}
                >
                  {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
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
