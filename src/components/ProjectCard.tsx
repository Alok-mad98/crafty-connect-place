import { Heart, Eye } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { type Project } from '@/data/projects'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()

  return (
    <div
      className="group bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 hover:-translate-y-1"
      onClick={() => navigate({ to: '/project/$id', params: { id: project.id } })}
    >
      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden bg-muted relative">
        <img
          src={project.image}
          alt={project.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {/* Category badge */}
        <span className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm text-foreground text-xs font-medium px-2.5 py-1 rounded-full border border-border">
          {project.category as string}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">
          {project.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {project.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={project.authorAvatar}
              alt={project.author}
              className="w-6 h-6 rounded-full object-cover"
            />
            <span className="text-xs text-muted-foreground">{project.author}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Heart size={14} />
            <span className="text-xs">{project.likes}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
