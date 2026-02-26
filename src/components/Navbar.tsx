"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import Button from "./ui/Button";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/vault", label: "Vault" },
  { href: "/forge", label: "Forge" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { login, logout, authenticated, user } = usePrivy();

  const displayAddress = user?.wallet?.address
    ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
    : null;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/[0.03] backdrop-blur-xl border-b border-white/[0.06]"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-white">
            NEXUS
          </span>
          <span className="text-xs text-white/40 font-mono">MCP</span>
        </Link>

        {/* Center nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  relative px-4 py-2 text-sm rounded-lg transition-colors duration-200
                  ${isActive ? "text-white" : "text-white/50 hover:text-white/80"}
                `}
              >
                {link.label}
                {isActive && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute inset-0 bg-white/[0.06] rounded-lg -z-10"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Auth button */}
        <div className="flex items-center gap-3">
          {authenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/60 font-mono">
                {displayAddress}
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="sm" onClick={login}>
              Connect
            </Button>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
