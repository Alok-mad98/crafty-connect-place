import { Link, useLocation } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";

const navLinks = [
  { href: "/", label: "HOME" },
  { href: "/vault", label: "VAULT" },
  { href: "/forge", label: "FORGE" },
  { href: "/mint", label: "MINT" },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { login, logout, authenticated, user } = usePrivy();

  const displayAddress = user?.wallet?.address
    ? `${user.wallet.address.slice(0, 6)}…${user.wallet.address.slice(-4)}`
    : null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-bg/80 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left – mono tag */}
        <div className="flex items-center gap-6">
          <span className="font-mono text-[10px] tracking-[0.3em] text-fg-dim hidden md:block">
            [N_X_25]
          </span>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={`
                  text-[10px] font-mono tracking-[0.15em] transition-colors duration-300 hidden md:block
                  ${isActive
                    ? "text-fg"
                    : "text-fg-dim hover:text-fg-muted"
                  }
                `}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Center – Brand */}
        <Link to="/" className="absolute left-1/2 -translate-x-1/2">
          <span className="font-serif text-lg md:text-xl tracking-[0.15em] text-fg font-light">
            Nexus
          </span>
        </Link>

        {/* Right – Wallet */}
        <div className="flex items-center gap-4">
          {authenticated ? (
            <>
              <span className="text-[10px] font-mono text-fg-dim tracking-wider">
                {displayAddress}
              </span>
              <button
                onClick={logout}
                className="text-[10px] font-mono text-fg-dim hover:text-fg-muted transition-colors tracking-wider cursor-pointer"
              >
                [×]
              </button>
            </>
          ) : (
            <button
              onClick={login}
              className="px-5 py-2 text-[10px] font-mono tracking-[0.2em] border border-border hover:border-border-hover text-fg-muted hover:text-fg transition-all duration-300 cursor-pointer"
            >
              CONNECT
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
