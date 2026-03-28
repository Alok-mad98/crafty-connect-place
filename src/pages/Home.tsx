import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Sparkles, Users, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/ProjectCard'
import { SAMPLE_PROJECTS, CATEGORIES } from '@/data/projects'

const FEATURED = SAMPLE_PROJECTS.slice(0, 6)
const STATS = [
  { label: 'Projects Shared', value: '12,400+', icon: Sparkles },
  { label: 'Active Makers', value: '3,800+', icon: Users },
  { label: 'Projects Liked', value: '94,000+', icon: Heart },
]

export function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Warm background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-background" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-primary/20">
            <Sparkles size={12} />
            A home for every maker
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight" style={{ fontFamily: 'Lora, serif' }}>
            Where Crafts Come to{' '}
            <span className="text-primary">Life</span>
          </h1>

          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Showcase your handmade creations, discover inspiring projects from fellow makers, and connect with a passionate craft community.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate({ to: '/explore' })}
              className="shadow-md hover:shadow-lg transition-shadow"
            >
              Explore Projects
              <ArrowRight size={18} className="ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate({ to: '/upload' })}
            >
              Share Your Work
            </Button>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {STATS.map(({ label, value, icon: Icon }) => (
              <div key={label} className="text-center">
                <div className="flex justify-center mb-1">
                  <Icon size={18} className="text-primary" />
                </div>
                <div className="text-xl font-bold text-foreground">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category pills */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => navigate({ to: '/explore', search: { category: cat } })}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border border-border text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-150"
            >
              {cat as string}
            </button>
          ))}
        </div>
      </section>

      {/* Featured Projects */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Lora, serif' }}>Featured Projects</h2>
            <p className="text-muted-foreground text-sm mt-1">Hand-picked by our community</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: '/explore' })}>
            View all
            <ArrowRight size={14} className="ml-1.5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURED.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-primary/5 border-y border-primary/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-3" style={{ fontFamily: 'Lora, serif' }}>
            Ready to share your craft?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join thousands of makers showcasing their handmade work. Upload photos, describe your process, and inspire others.
          </p>
          <Button size="lg" onClick={() => navigate({ to: '/upload' })}>
            Share a Project
            <ArrowRight size={18} className="ml-2" />
          </Button>
        </div>
      </section>
    </div>
  )
}
