export type Category = 'All' | 'Knitting' | 'Pottery' | 'Painting' | 'Macramé' | 'Woodwork' | 'Embroidery' | 'Jewelry'

export interface Project {
  id: string
  title: string
  description: string
  image: string
  category: Omit<Category, 'All'>
  author: string
  authorAvatar: string
  likes: number
  tags: string[]
  createdAt: string
}

export const CATEGORIES: Category[] = ['All', 'Knitting', 'Pottery', 'Painting', 'Macramé', 'Woodwork', 'Embroidery', 'Jewelry']

export const SAMPLE_PROJECTS: Project[] = [
  {
    id: '1',
    title: 'Hand-Knitted Cable Sweater',
    description: 'A cozy cable-knit sweater made from 100% merino wool. This took 3 weeks of evenings and weekends. The pattern is my own design inspired by traditional Irish fisherman sweaters.',
    image: 'https://images.unsplash.com/photo-1604671801908-6f0c6a092c05?w=600&q=80',
    category: 'Knitting',
    author: 'Maya Chen',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
    likes: 142,
    tags: ['wool', 'cable-knit', 'sweater', 'wearable'],
    createdAt: '2024-02-15',
  },
  {
    id: '2',
    title: 'Speckled Stoneware Mugs',
    description: 'A set of four wheel-thrown mugs with a natural speckled glaze. Each one is slightly different — that\'s the beauty of hand pottery. Food-safe and dishwasher safe.',
    image: 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&q=80',
    category: 'Pottery',
    author: 'James Rivera',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
    likes: 98,
    tags: ['pottery', 'stoneware', 'mugs', 'functional'],
    createdAt: '2024-02-10',
  },
  {
    id: '3',
    title: 'Wildflower Watercolor Series',
    description: 'A series of five botanical watercolor illustrations featuring native wildflowers. Painted on cold-press paper with professional-grade pigments.',
    image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&q=80',
    category: 'Painting',
    author: 'Sofia Patel',
    authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80',
    likes: 217,
    tags: ['watercolor', 'botanical', 'flowers', 'illustration'],
    createdAt: '2024-02-08',
  },
  {
    id: '4',
    title: 'Bohemian Wall Hanging',
    description: 'Large macramé wall hanging with feathers, beads and natural cotton rope. Measures 60cm wide x 90cm long. Perfect for boho living room decor.',
    image: 'https://images.unsplash.com/photo-1558171813-df97b02e3d86?w=600&q=80',
    category: 'Macramé',
    author: 'Luna Tran',
    authorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&q=80',
    likes: 183,
    tags: ['macrame', 'wall-art', 'boho', 'home-decor'],
    createdAt: '2024-02-05',
  },
  {
    id: '5',
    title: 'Live-Edge Oak Coffee Table',
    description: 'Handcrafted coffee table from a single slab of live-edge oak. Finished with danish oil to preserve the natural beauty of the grain. Legs are hand-forged steel.',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    category: 'Woodwork',
    author: 'Tom Nakamura',
    authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80',
    likes: 305,
    tags: ['woodwork', 'furniture', 'oak', 'live-edge'],
    createdAt: '2024-01-28',
  },
  {
    id: '6',
    title: 'Vintage Floral Embroidery Hoop',
    description: 'Hand-embroidered hoop art featuring a vintage-inspired floral bouquet. Stitched with DMC threads on natural linen. Comes ready to hang.',
    image: 'https://images.unsplash.com/photo-1580870069867-74c57ee1bb07?w=600&q=80',
    category: 'Embroidery',
    author: 'Iris Kowalski',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80',
    likes: 156,
    tags: ['embroidery', 'hoop-art', 'floral', 'hand-stitch'],
    createdAt: '2024-01-22',
  },
  {
    id: '7',
    title: 'Hammered Copper Cuff Bracelet',
    description: 'Hand-forged copper cuff with hammered texture. Each piece is unique due to the handmade process. Finished with a liver of sulfur patina for an antiqued look.',
    image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600&q=80',
    category: 'Jewelry',
    author: 'Aria Santos',
    authorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&q=80',
    likes: 89,
    tags: ['jewelry', 'copper', 'metalwork', 'bracelet'],
    createdAt: '2024-01-18',
  },
  {
    id: '8',
    title: 'Ceramic Succulent Planters',
    description: 'A collection of handbuilt succulent planters with geometric cutout designs. Each planter has drainage holes and is fired to cone 6 in an electric kiln.',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&q=80',
    category: 'Pottery',
    author: 'James Rivera',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
    likes: 124,
    tags: ['pottery', 'planters', 'succulents', 'geometric'],
    createdAt: '2024-01-15',
  },
]
