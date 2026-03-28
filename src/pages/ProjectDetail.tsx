import { useParams, useNavigate } from '@tanstack/react-router'
import { Heart, ArrowLeft, Tag, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SAMPLE_PROJECTS } from '@/data/projects'
import { ProjectCard } from '@/components/ProjectCard'

export function ProjectDetail() {
  const { id } = useParams({ from: '/project/$id' })
  const navigate = useNavigate()

  const project = SAMPLE_PROJECTS.find((p) => p.id === id)

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-5xl">😕</p>
        <h2 className="text-xl font-semibold text-foreground">Project not found</h2>
        <Button onClick={() => navigate({ to: '/explore' })}>Browse Projects</Button>
      </div>
    )
  }

  const related = SAMPLE_PROJECTS.filter(
    (p) => p.id !== project.id && p.category === project.category
  ).slice(0, 3)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <Button variant="ghost" size="sm" className="mb-6 -ml-2" onClick={() => navigate({ to: '/explore' })}>
          <ArrowLeft size={16} className="mr-1.5" />
          Back to Explore
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Image */}
          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
            <img
              src={project.image}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details */}
          <div>
            {/* Category */}
            <span className="inline-block text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full mb-4">
              {project.category as string}
            </span>

            <h1 className="text-3xl font-bold text-foreground mb-3" style={{ fontFamily: 'Lora, serif' }}>
              {project.title}
            </h1>

            {/* Author */}
            <div className="flex items-center gap-3 mb-6">
              <img
                src={project.authorAvatar}
                alt={project.author}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-border"
              />
              <div>
                <div className="font-medium text-sm text-foreground">{project.author}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar size={11} />
                  {new Date(project.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-6">{project.description}</p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-8">
              {project.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded-full border border-border">
                  <Tag size={11} />
                  {tag}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button className="flex-1">
                <Heart size={16} className="mr-2" />
                Like ({project.likes})
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: '/upload' })}>
                Share Similar
              </Button>
            </div>
          </div>
        </div>

        {/* Related Projects */}
        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-bold text-foreground mb-6" style={{ fontFamily: 'Lora, serif' }}>
              More {project.category as string} Projects
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
