"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User } from "lucide-react"

interface AvatarWithFallbackProps {
  src?: string
  fallbackText?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export default function AvatarWithFallback({
  src,
  fallbackText = "U",
  className = "",
  size = "md",
}: AvatarWithFallbackProps) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  }

  const handleImageError = () => {
    console.log("Avatar image failed to load, using fallback")
    setImageError(true)
    setIsLoading(false)
  }

  const handleImageLoad = () => {
    setIsLoading(false)
    setImageError(false)
  }

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      {src && !imageError && (
        <AvatarImage
          src={src || "/placeholder.svg"}
          onError={handleImageError}
          onLoad={handleImageLoad}
          className={isLoading ? "opacity-0" : "opacity-100 transition-opacity"}
        />
      )}
      <AvatarFallback className="bg-green-100 text-green-700 font-semibold">
        {fallbackText.length >= 2 ? (
          <span className={size === "sm" ? "text-xs" : size === "lg" ? "text-2xl" : "text-lg"}>{fallbackText}</span>
        ) : (
          <User className={size === "sm" ? "w-4 h-4" : size === "lg" ? "w-8 h-8" : "w-6 h-6"} />
        )}
      </AvatarFallback>
    </Avatar>
  )
}
