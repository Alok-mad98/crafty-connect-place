"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function MasterAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I am the Nexus Orchestrator. Need help integrating a skill?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer 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",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "You are the Master AI of the AI Skills Marketplace — a decentralized platform where humans and AI agents buy and sell .md skill files via MCP (Model Context Protocol). You help users understand what MCP skills are, browse skills in The Vault, launch new skills in The Forge, understand USDC payments on Base chain, and troubleshoot MCP connections. Be concise, helpful, and knowledgeable about Web3 and AI agents. Never execute transactions — only advise.",
            },
            ...newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          ],
          temperature: 0.7,
          max_tokens: 1024,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Chat request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + content,
                  };
                }
                return updated;
              });
            }
          } catch {
            // Skip
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content: "Sorry, I encountered an error. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages]);

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-12 h-12 border border-border bg-bg-card flex items-center justify-center cursor-pointer hover:bg-bg-elevated hover:border-border-hover transition-colors"
          >
            <span className="font-mono text-xs text-fg-muted">AI</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] h-[480px] bg-bg-card border border-border flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <p className="font-mono text-[10px] tracking-widest text-fg-dim">[master_ai]</p>
                <h3 className="text-sm font-medium text-fg">Nexus Orchestrator</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-fg-dim hover:text-fg-muted transition-colors font-mono text-xs"
              >
                [×]
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 text-xs font-mono leading-relaxed ${
                      msg.role === "user"
                        ? "bg-fg-ghost text-fg border border-border"
                        : "text-fg-muted"
                    }`}
                  >
                    {msg.content || (
                      <span className="inline-flex gap-1">
                        <span className="w-1 h-1 rounded-full bg-fg-dim animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1 h-1 rounded-full bg-fg-dim animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1 h-1 rounded-full bg-fg-dim animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Ask about skills..."
                  className="flex-1 bg-transparent border border-border px-3 py-2 text-xs text-fg font-mono placeholder:text-fg-dim focus:outline-none focus:border-border-hover transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  className="px-3 py-2 border border-border text-fg-muted hover:text-fg hover:border-border-hover font-mono text-[10px] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
