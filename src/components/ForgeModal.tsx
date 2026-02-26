import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "./ui/Button";

const MODEL_OPTIONS = ["CLAUDE", "GPT4", "LLAMA", "GEMINI"] as const;

interface ForgeState {
  file: File | null;
  title: string;
  description: string;
  price: string;
  modelTags: string[];
}

export default function ForgeModal() {
  const [state, setState] = useState<ForgeState>({
    file: null,
    title: "",
    description: "",
    price: "5.00",
    modelTags: [],
  });
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".md")) {
      setState((s) => ({ ...s, file }));
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.name.endsWith(".md")) {
      setState((s) => ({ ...s, file }));
    }
  }, []);

  const toggleTag = (tag: string) => {
    setState((s) => ({
      ...s,
      modelTags: s.modelTags.includes(tag)
        ? s.modelTags.filter((t) => t !== tag)
        : [...s.modelTags, tag],
    }));
  };

  const handleSubmit = async () => {
    if (!state.file || !state.title || !state.description) {
      setError("Please fill in all fields and upload a .md file");
      return;
    }

    const price = parseFloat(state.price);
    if (isNaN(price) || price < 2.0) {
      setError("Minimum price is 2.00 USDC");
      return;
    }

    setError(null);
    setStatus("uploading");

    try {
      // TODO: Implement with Lovable Cloud + wallet integration
      console.log("Submitting skill:", state);
      setTimeout(() => setStatus("done"), 1500);
    } catch (err) {
      console.error("Forge error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  const statusMessages: Record<string, string> = {
    uploading: "Processing skill...",
    done: "Skill launched successfully!",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full max-w-xl mx-auto bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/30 p-8"
    >
      <h2 className="text-2xl font-bold text-white mb-2">Launch a Skill</h2>
      <p className="text-sm text-white/40 mb-8">
        Upload your .md skill file, set a price, and mint it onchain.
      </p>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-all duration-200 cursor-pointer
          ${isDragging ? "border-amber-warm/50 bg-amber-warm/[0.04]" : "border-white/[0.15] hover:border-white/[0.25]"}
          ${state.file ? "border-emerald-400/30 bg-emerald-400/[0.02]" : ""}
        `}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".md"
          onChange={handleFileChange}
          className="hidden"
        />
        {state.file ? (
          <div className="flex items-center justify-center gap-3">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-mono text-white/70">{state.file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setState((s) => ({ ...s, file: null }));
              }}
              className="text-white/30 hover:text-white/60 text-xs"
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <svg className="w-10 h-10 mx-auto mb-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-white/40">
              Drag & drop your <span className="font-mono text-white/60">.md</span> skill file here
            </p>
            <p className="text-xs text-white/20 mt-1">or click to browse</p>
          </>
        )}
      </div>

      {/* Title */}
      <div className="mb-4">
        <label className="text-xs text-white/40 mb-1.5 block">Skill Title</label>
        <input
          type="text"
          value={state.title}
          onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
          placeholder="e.g. Advanced Code Review Agent"
          className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.2] transition-colors"
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="text-xs text-white/40 mb-1.5 block">Description</label>
        <textarea
          value={state.description}
          onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
          placeholder="What does this skill do? What models is it optimized for?"
          rows={3}
          className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.2] transition-colors resize-none"
        />
      </div>

      {/* Model Tags */}
      <div className="mb-4">
        <label className="text-xs text-white/40 mb-1.5 block">Compatible Models</label>
        <div className="flex flex-wrap gap-2">
          {MODEL_OPTIONS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`
                px-3 py-1.5 text-xs font-mono rounded-lg border transition-all duration-200
                ${
                  state.modelTags.includes(tag)
                    ? "bg-white/[0.1] border-white/[0.2] text-white"
                    : "bg-transparent border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/[0.12]"
                }
              `}
            >
              [{tag}]
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="mb-6">
        <label className="text-xs text-white/40 mb-1.5 block">Price (USDC)</label>
        <div className="relative">
          <input
            type="number"
            min="2"
            step="0.01"
            value={state.price}
            onChange={(e) => setState((s) => ({ ...s, price: e.target.value }))}
            className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-white/[0.2] transition-colors"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-white/30">
            USDC
          </span>
        </div>
        <p className="text-[10px] text-white/20 mt-1">Minimum 2.00 USDC</p>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 rounded-lg bg-red-500/[0.1] border border-red-500/[0.2] text-xs text-red-400"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status */}
      {status !== "idle" && status !== "error" && (
        <div className="mb-4 p-3 rounded-lg bg-amber-warm/[0.06] border border-amber-warm/[0.1] text-xs text-amber-warm/80 flex items-center gap-2">
          {status !== "done" && (
            <div className="w-3 h-3 border-2 border-amber-warm/40 border-t-amber-warm rounded-full animate-spin" />
          )}
          {status === "done" && (
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {statusMessages[status]}
        </div>
      )}

      {/* Submit Button */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={status === "uploading"}
      >
        {status === "done" ? "Skill Launched!" : "Pay 0.5 USDC to Mint Skill"}
      </Button>

      <p className="text-[10px] text-white/20 text-center mt-3">
        0.5 USDC listing fee &middot; 95% of sales go to you &middot; Verified by Master AI
      </p>
    </motion.div>
  );
}
