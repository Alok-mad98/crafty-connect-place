"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

type ButtonVariant = "primary" | "ghost" | "accent";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-fg text-bg font-medium hover:bg-fg/90 active:bg-fg/80",
  ghost:
    "border border-border text-fg-muted hover:text-fg hover:border-border-hover active:bg-fg-ghost",
  accent:
    "border border-accent/30 text-accent hover:border-accent/50 hover:text-accent-glow active:bg-accent-muted",
};

const sizes = {
  sm: "px-4 py-2 text-[10px]",
  md: "px-6 py-2.5 text-[11px]",
  lg: "px-10 py-3.5 text-[11px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = "primary", size = "md", className = "", ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={`
          font-mono tracking-[0.2em] cursor-pointer
          transition-all duration-300
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
export default Button;
