import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Menu, X, Palette, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Palette size={18} className="text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground" style={{ fontFamily: 'Lora, serif' }}>
              CraftyConnect
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/explore" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
              Explore
            </Link>
            <Link to="/upload" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
              Share Project
            </Link>
            <Link to="/profile" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
              Profile
            </Link>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/explore' })}>
              <Search size={16} className="mr-1.5" />
              Browse
            </Button>
            <Button size="sm" onClick={() => navigate({ to: '/upload' })}>
              Share a Project
            </Button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-3">
          <Link to="/explore" className="block py-2 text-sm font-medium text-foreground" onClick={() => setMenuOpen(false)}>
            Explore Projects
          </Link>
          <Link to="/upload" className="block py-2 text-sm font-medium text-foreground" onClick={() => setMenuOpen(false)}>
            Share a Project
          </Link>
          <Link to="/profile" className="block py-2 text-sm font-medium text-foreground" onClick={() => setMenuOpen(false)}>
            Profile
          </Link>
          <Button className="w-full mt-2" onClick={() => { navigate({ to: '/upload' }); setMenuOpen(false) }}>
            Share a Project
          </Button>
        </div>
      )}
    </nav>
  )
}
