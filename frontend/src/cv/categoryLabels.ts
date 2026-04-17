/** Display names for backend `category` strings (GET /api/ops). */

export const CATEGORY_LABELS: Record<string, string> = {
  detection: 'Detection',
  geometric: 'Geometric',
  color: 'Color',
  intensity: 'Intensity',
  linear: 'Linear & smoothing',
  morphology: 'Morphology',
  edges: 'Edges & gradients',
  texture: 'Texture & analysis',
  denoise: 'Denoising',
  noise: 'Noise',
  fourier: 'Fourier',
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1)
}
