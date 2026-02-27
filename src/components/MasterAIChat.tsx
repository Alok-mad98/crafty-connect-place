"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy, useWallets } from "@privy-io/react-auth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://xiofvutfjujnzdzlgmyc.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpb2Z2dXRmanVqbnpkemxnbXljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDcyNzQsImV4cCI6MjA4NzY4MzI3NH0.8a7yzvhXTYqHFXacCBvT3lCUiJRBkYAQ3kmDLYv2QX8";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function MasterAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "I am the Nexus Orchestrator. I can help you integrate skills, manage your agent wallet, or forge new skills. What do you need?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentWallet, setAgentWallet] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const conversationHistory = messages.filter((m) => m.content);
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const userWallet = wallets[0]?.address || null;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/cdp-agent/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          message: input.trim(),
          userWallet,
          conversationHistory: conversationHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Request failed (${res.status})`);
      }

      const data = await res.json();

      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, content: data.response };
        }
        return updated;
      });

      if (data.walletAddress) {
        setAgentWallet(data.walletAddress);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}. Try again.`,
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, wallets]);

  return (
    <>
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] h-[520px] bg-bg-card border border-border flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <p className="font-mono text-[10px] tracking-widest text-fg-dim">[master_ai]</p>
                <h3 className="text-sm font-medium text-fg">Nexus Orchestrator</h3>
                {agentWallet && (
                  <p className="font-mono text-[8px] text-success/70 mt-0.5">
                    wallet: {agentWallet.slice(0, 6)}...{agentWallet.slice(-4)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-fg-dim hover:text-fg-muted transition-colors font-mono text-xs"
              >
                [×]
              </button>
            </div>

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
                    className={`max-w-[85%] px-3 py-2 text-xs font-mono leading-relaxed whitespace-pre-wrap ${
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

            {/* Status bar */}
            {authenticated && (
              <div className="px-4 py-1.5 border-t border-border/50 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success/60" />
                <span className="font-mono text-[8px] text-fg-dim">
                  connected · {wallets[0]?.address?.slice(0, 6)}...{wallets[0]?.address?.slice(-4)}
                </span>
              </div>
            )}

            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={authenticated ? "Ask the Orchestrator..." : "Connect wallet to chat..."}
                  className="flex-1 bg-transparent border border-border px-3 py-2 text-xs text-fg font-mono placeholder:text-fg-dim focus:outline-none focus:border-border-hover transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
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
