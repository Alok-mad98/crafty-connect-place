import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Upload as UploadIcon, ImagePlus, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CATEGORIES } from '@/data/projects'

export function Upload() {
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
    imageUrl: '',
  })

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: 'Lora, serif' }}>
            Project Shared!
          </h2>
          <p className="text-muted-foreground max-w-sm">
            Your project has been submitted and will be visible to the community shortly.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate({ to: '/explore' })}>Explore Projects</Button>
          <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ title: '', description: '', category: '', tags: '', imageUrl: '' }) }}>
            Share Another
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
            <UploadIcon size={20} className="text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Lora, serif' }}>
            Share Your Project
          </h1>
          <p className="text-muted-foreground mt-1">Show the community what you've been making</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image upload area */}
          <div>
            <Label className="text-foreground mb-2 block">Project Photo</Label>
            {form.imageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-border aspect-video bg-muted">
                <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  className="absolute top-2 right-2 bg-background/80 rounded-full px-2 py-1 text-xs text-foreground hover:bg-background"
                  onClick={() => handleChange('imageUrl', '')}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-xl p-10 text-center bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                <ImagePlus size={28} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">Upload a photo</p>
                <p className="text-xs text-muted-foreground mb-4">PNG, JPG, WebP up to 10MB</p>
                <Input
                  placeholder="Or paste an image URL..."
                  value={form.imageUrl}
                  onChange={(e) => handleChange('imageUrl', e.target.value)}
                  className="max-w-xs mx-auto"
                />
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title" className="text-foreground mb-2 block">Project Title *</Label>
            <Input
              id="title"
              required
              placeholder="e.g. Hand-Knitted Cable Sweater"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
            />
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="category" className="text-foreground mb-2 block">Category *</Label>
            <select
              id="category"
              required
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a category</option>
              {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                <option key={cat as string} value={cat as string}>{cat as string}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-foreground mb-2 block">Description *</Label>
            <Textarea
              id="description"
              required
              rows={5}
              placeholder="Describe your project — materials used, time taken, techniques, inspiration..."
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>

          {/* Tags */}
          <div>
            <Label htmlFor="tags" className="text-foreground mb-2 block">Tags</Label>
            <Input
              id="tags"
              placeholder="e.g. wool, handmade, gift (comma separated)"
              value={form.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Helps others discover your project</p>
          </div>

          {/* Submit */}
          <Button type="submit" size="lg" className="w-full">
            <UploadIcon size={18} className="mr-2" />
            Share Project
          </Button>
        </form>
      </div>
    </div>
  )
}
