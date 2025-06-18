"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Upload, Loader2, AlertCircle, CheckCircle, Camera } from "lucide-react"
import { apiCall } from "@/lib/api-config"

interface User {
  id: number
  email: string
  profilePicture: string
  rating: number
  firstName: string
  lastName: string
  connectedAccount: string
}

interface ProfilePictureUploadProps {
  userData: User
  onBack: () => void
  onSuccess: (newProfilePicture: string) => void
}

export default function ProfilePictureUpload({ userData, onBack, onSuccess }: ProfilePictureUploadProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB")
      return
    }

    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const convertImageToHex = (imageData: string): Promise<{ hexString: string; base64Preview: string }> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()

      img.crossOrigin = "anonymous"
      img.onload = () => {
        try {
          // Resize image to reasonable size (max 200x200)
          const maxSize = 200
          let { width, height } = img

          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width
              width = maxSize
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height
              height = maxSize
            }
          }

          canvas.width = width
          canvas.height = height

          // Draw image to canvas
          ctx?.drawImage(img, 0, 0, width, height)

          // Get image data as RGB values
          const imageData = ctx?.getImageData(0, 0, width, height)
          if (!imageData) {
            reject(new Error("Failed to get image data"))
            return
          }

          // Convert to RGB array (skip alpha channel)
          const rgbArray: number[] = []
          for (let i = 0; i < imageData.data.length; i += 4) {
            rgbArray.push(imageData.data[i]) // R
            rgbArray.push(imageData.data[i + 1]) // G
            rgbArray.push(imageData.data[i + 2]) // B
            // Skip alpha channel (i + 3)
          }

          // Convert RGB values to hex string
          let hexString = ""
          for (const value of rgbArray) {
            const hex = value.toString(16).padStart(2, "0")
            hexString += hex
          }

          // Also create a base64 preview for immediate display
          const base64Preview = canvas.toDataURL("image/jpeg", 0.8)

          console.log("Image converted to hex. Length:", hexString.length)
          console.log("RGB array length:", rgbArray.length)
          console.log("Canvas dimensions:", width, "x", height)

          resolve({ hexString, base64Preview })
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => {
        reject(new Error("Failed to load image"))
      }

      img.src = imageData
    })
  }

  const handleUpload = async () => {
    if (!selectedImage) {
      setError("Please select an image first")
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      console.log("Converting image to hex...")
      const { hexString, base64Preview } = await convertImageToHex(selectedImage)
      console.log("Hex string length:", hexString.length)

      console.log("Uploading profile picture...")
      const response = await apiCall("/api/users/profilePicture", {
        method: "PUT",
        body: JSON.stringify({
          userId: userData.id,
          incriptedImmage: hexString, // Send as hex string
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Upload failed:", errorText)
        throw new Error(`Upload failed: ${response.status} - ${errorText}`)
      }

      console.log("Profile picture uploaded successfully")
      setSuccess(true)

      // Call success callback with the base64 preview for immediate display
      onSuccess(base64Preview)

      setTimeout(() => {
        onBack()
      }, 2000)
    } catch (error) {
      console.error("Error uploading profile picture:", error)
      setError(error instanceof Error ? error.message : "An unexpected error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Picture Updated!</h2>
            <p className="text-gray-600">Your new profile picture has been uploaded successfully.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-semibold text-gray-900">Update Profile Picture</h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Camera className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">Upload New Picture</CardTitle>
            <CardDescription className="text-gray-600">
              Choose a new profile picture to update your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Current/Selected Image Preview */}
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 border-4 border-gray-300">
                <img
                  src={selectedImage || userData.profilePicture || "/placeholder.svg?height=128&width=128"}
                  alt="Profile preview"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

            {/* Upload button */}
            <Button
              onClick={triggerFileInput}
              disabled={isProcessing}
              variant="outline"
              className="w-full h-12 border-dashed border-2 hover:bg-gray-50"
            >
              <Upload className="w-5 h-5 mr-2" />
              {selectedImage ? "Choose Different Image" : "Choose Image"}
            </Button>

            {/* Upload/Save button */}
            {selectedImage && (
              <Button
                onClick={handleUpload}
                disabled={isProcessing}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing Image...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Upload Profile Picture
                  </>
                )}
              </Button>
            )}

            <div className="text-xs text-gray-500 text-center space-y-1">
              <p>• Supported formats: JPG, PNG, GIF</p>
              <p>• Maximum file size: 5MB</p>
              <p>• Image will be converted to hex format</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
