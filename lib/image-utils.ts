interface ImageCache {
  [url: string]: {
    status: "loading" | "success" | "error"
    timestamp: number
  }
}

class ImageCacheManager {
  private cache: ImageCache = {}
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  async preloadImage(url: string): Promise<boolean> {
    // Check cache first
    const cached = this.cache[url]
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.status === "success"
    }

    // Mark as loading
    this.cache[url] = { status: "loading", timestamp: Date.now() }

    try {
      await new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Failed to load image"))
        img.src = url
      })

      this.cache[url] = { status: "success", timestamp: Date.now() }
      return true
    } catch (error) {
      console.log(`Failed to preload image: ${url}`)
      this.cache[url] = { status: "error", timestamp: Date.now() }
      return false
    }
  }

  getCacheStatus(url: string): "loading" | "success" | "error" | "unknown" {
    const cached = this.cache[url]
    if (!cached || Date.now() - cached.timestamp > this.CACHE_DURATION) {
      return "unknown"
    }
    return cached.status
  }

  clearCache(): void {
    this.cache = {}
  }
}

export const imageCache = new ImageCacheManager()

// Helper function to get a safe avatar URL with fallback
export const getSafeAvatarUrl = (url?: string): string | undefined => {
  if (!url) return undefined

  // Check if it's a Google profile image that might be rate limited
  if (url.includes("googleusercontent.com")) {
    const cacheStatus = imageCache.getCacheStatus(url)
    if (cacheStatus === "error") {
      return undefined // Force fallback
    }
  }

  return url
}

// Preload avatar images to reduce loading time
export const preloadAvatarImage = async (url?: string): Promise<boolean> => {
  if (!url) return false
  return await imageCache.preloadImage(url)
}
