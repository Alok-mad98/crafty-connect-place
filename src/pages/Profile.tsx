import { useNavigate } from '@tanstack/react-router'
import { MapPin, Calendar, Heart, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/ProjectCard'
import { SAMPLE_PROJECTS } from '@/data/projects'

const USER = {
  name: 'Maya Chen',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
  bio: 'Textile artist and knitting enthusiast. I love working with natural fibers and creating wearable art.',
  location: 'Portland, OR',
  joined: 'January 2023',
  projects: 12,
  likes: 487,
}

const MY_PROJECTS = SAMPLE_PROJECTS.slice(0, 3)

export function Profile() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      {/* Profile banner */}
      <div className="h-36 bg-gradient-to-r from-primary/20 via-accent/20 to-secondary" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Avatar + info */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 mb-8">
          <img
            src={USER.avatar}
            alt={USER.name}
            className="w-24 h-24 rounded-2xl object-cover ring-4 ring-background shadow-md"
          />
          <div className="flex-1 pb-1">
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Lora, serif' }}>{USER.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{USER.bio}</p>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin size={12} />{USER.location}</span>
              <span className="flex items-center gap-1"><Calendar size={12} />Joined {USER.joined}</span>
            </div>
          </div>
          <Button variant="outline" size="sm">Edit Profile</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Projects', value: USER.projects, icon: Package },
            { label: 'Likes Received', value: USER.likes, icon: Heart },
            { label: 'Following', value: 38, icon: null },
            { label: 'Followers', value: 124, icon: null },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card rounded-xl border border-border p-4 text-center">
              {Icon && <Icon size={18} className="text-primary mx-auto mb-1" />}
              <div className="text-2xl font-bold text-foreground">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'Lora, serif' }}>My Projects</h2>
            <Button size="sm" onClick={() => navigate({ to: '/upload' })}>
              + New Project
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {MY_PROJECTS.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
