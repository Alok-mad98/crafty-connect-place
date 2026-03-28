import { Palette } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/30 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                <Palette size={15} className="text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground" style={{ fontFamily: 'Lora, serif' }}>CraftyConnect</span>
            </div>
            <p className="text-sm text-muted-foreground">
              A community for makers to showcase, discover, and collaborate on art and craft projects.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/explore" className="hover:text-foreground transition-colors">All Projects</a></li>
              <li><a href="/explore" className="hover:text-foreground transition-colors">Pottery</a></li>
              <li><a href="/explore" className="hover:text-foreground transition-colors">Knitting</a></li>
              <li><a href="/explore" className="hover:text-foreground transition-colors">Woodwork</a></li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">Community</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/upload" className="hover:text-foreground transition-colors">Share Your Work</a></li>
              <li><a href="/profile" className="hover:text-foreground transition-colors">Your Profile</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-10 pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} CraftyConnect Place. Made with ♥ for makers everywhere.
        </div>
      </div>
    </footer>
  )
}
