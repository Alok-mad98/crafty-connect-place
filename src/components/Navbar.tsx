"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

const navLinks = [
  { href: "/", label: "HOME" },
  { href: "/vault", label: "VAULT" },
  { href: "/forge", label: "FORGE" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { login, logout, authenticated, user } = usePrivy();

  const displayAddress = user?.wallet?.address
    ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
    : null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xs font-mono text-fg-muted">[N_X]</span>
          <span className="text-sm font-semibold tracking-widest text-fg">NEXUS</span>
        </Link>

        {/* Center nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  text-xs font-mono tracking-wider transition-colors duration-200 pb-0.5
                  ${isActive
                    ? "text-fg border-b border-fg"
                    : "text-fg-muted hover:text-fg"
                  }
                `}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {authenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-fg-muted">
                {displayAddress}
              </span>
              <button
                onClick={logout}
                className="text-xs font-mono text-fg-dim hover:text-fg-muted transition-colors"
              >
                DISCONNECT
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="px-5 py-2 text-xs font-mono tracking-wider border border-border hover:border-border-hover text-fg transition-all duration-200 rounded-sm"
            >
              CONNECT
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
