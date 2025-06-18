"use client"

import { useAuth0 } from "@auth0/auth0-react"
import { useEffect, useState } from "react"
import LoginScreen from "./login-screen"
import UserRegistration from "./user-registration"
import DriverHomescreen from "../driver-homescreen"
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

export default function AuthWrapper() {
  const { isAuthenticated, isLoading, user } = useAuth0()
  const [userExists, setUserExists] = useState<boolean | null>(null)
  const [userData, setUserData] = useState<User | null>(null)
  const [checkingUser, setCheckingUser] = useState(false)

  useEffect(() => {
    if (isAuthenticated && user?.email && userExists === null && !checkingUser) {
      // Start user check immediately but don't block UI
      checkUserExists(user.email)
    }
  }, [isAuthenticated, user?.email, userExists, checkingUser])

  // Helper function to convert hex string to base64 image
  const hexToBase64Image = (hexString: string): string => {
    try {
      console.log("Converting hex to base64. Hex length:", hexString.length)

      // Ensure hex string has even length
      if (hexString.length % 2 !== 0) {
        console.error("Invalid hex string length:", hexString.length)
        throw new Error("Invalid hex string length")
      }

      // Convert hex to bytes (RGB values)
      const bytes = new Uint8Array(hexString.length / 2)
      for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = Number.parseInt(hexString.substr(i, 2), 16)
      }

      console.log("Converted to", bytes.length, "bytes")

      // Calculate image dimensions (assuming square image)
      const totalPixels = bytes.length / 3 // 3 bytes per pixel (RGB)
      const dimension = Math.sqrt(totalPixels)
      const width = Math.floor(dimension)
      const height = Math.floor(dimension)

      console.log("Calculated dimensions:", width, "x", height)

      // Create canvas and draw image
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        throw new Error("Could not get canvas context")
      }

      // Create ImageData from RGB bytes
      const imageData = ctx.createImageData(width, height)
      for (let i = 0; i < width * height; i++) {
        const rgbIndex = i * 3
        const pixelIndex = i * 4

        if (rgbIndex + 2 < bytes.length) {
          imageData.data[pixelIndex] = bytes[rgbIndex] // R
          imageData.data[pixelIndex + 1] = bytes[rgbIndex + 1] // G
          imageData.data[pixelIndex + 2] = bytes[rgbIndex + 2] // B
          imageData.data[pixelIndex + 3] = 255 // A (fully opaque)
        }
      }

      // Put image data on canvas
      ctx.putImageData(imageData, 0, 0)

      // Convert to base64 data URL
      const base64DataUrl = canvas.toDataURL("image/jpeg", 0.8)
      console.log("Successfully converted hex to base64 image")

      return base64DataUrl
    } catch (error) {
      console.error("Error converting hex to base64:", error)
      throw error
    }
  }

  const checkUserExists = async (email: string) => {
    setCheckingUser(true)
    try {
      const response = await apiCall(`/api/users/email/${encodeURIComponent(email)}`, {
        method: "GET",
      })

      if (response.status === 200) {
        const backendUserData = await response.json()
        console.log("Backend user data:", backendUserData)
        console.log("Backend profilePicture field:", backendUserData.profilePicture)
        console.log("Auth0 picture:", user?.picture)

        // Determine which profile picture to use
        let profilePicture = ""

        if (
          backendUserData.profilePicture &&
          backendUserData.profilePicture.trim() !== "" &&
          backendUserData.profilePicture !== "null" &&
          backendUserData.profilePicture !== null
        ) {
          // Check if it's a base64 data URL (starts with data:image/)
          if (backendUserData.profilePicture.startsWith("data:image/")) {
            profilePicture = backendUserData.profilePicture
          }
          // Check if it's a hex string (only contains hex characters and is long enough)
          else if (
            /^[0-9a-fA-F]+$/.test(backendUserData.profilePicture) &&
            backendUserData.profilePicture.length > 100
          ) {
            try {
              profilePicture = hexToBase64Image(backendUserData.profilePicture)
              console.log("Successfully converted hex profile picture to base64")
            } catch (error) {
              console.error("Failed to convert hex to image:", error)
              profilePicture = user?.picture || ""
            }
          }
          // Check if it's a regular URL
          else if (backendUserData.profilePicture.startsWith("http")) {
            profilePicture = backendUserData.profilePicture
          }
          // Otherwise use Auth0 picture
          else {
            console.log("Backend profile picture format not recognized, using Auth0 picture")
            profilePicture = user?.picture || ""
          }
        } else {
          // Use Auth0 picture as fallback
          profilePicture = user?.picture || ""
        }

        console.log(
          "Final profilePicture used:",
          profilePicture ? "Set (length: " + profilePicture.length + ")" : "Empty",
        )

        const userData: User = {
          id: backendUserData.id,
          email: backendUserData.email,
          profilePicture: profilePicture,
          rating: backendUserData.rating || 5.0,
          firstName: backendUserData.firstName,
          lastName: backendUserData.lastName,
          connectedAccount: backendUserData.connectedAccount || "",
        }

        console.log("Processed user data:", userData)
        setUserData(userData)
        setUserExists(true)
      } else if (response.status === 404) {
        setUserExists(false)
      } else {
        console.error("Unexpected response status:", response.status)
        // Don't block the UI, just assume user doesn't exist
        setUserExists(false)
      }
    } catch (error) {
      console.error("Error checking user:", error)
      // Don't block the UI, show registration form
      setUserExists(false)
    } finally {
      setCheckingUser(false)
    }
  }

  const handleRegistrationComplete = () => {
    if (user?.email) {
      // Reset state and check again
      setUserExists(null)
      setUserData(null)
      checkUserExists(user.email)
    }
  }

  // Only show loading for Auth0 authentication - make it very brief
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  // Show registration form if we know user doesn't exist
  if (userExists === false && user?.email) {
    return <UserRegistration email={user.email} onRegistrationComplete={handleRegistrationComplete} />
  }

  // Show main app if we have user data
  if (userExists === true && userData) {
    return <DriverHomescreen userData={userData} />
  }

  // Show main app immediately with default data - no loading screen
  if (isAuthenticated && user?.email) {
    const defaultUserData: User = {
      id: 0, // Will be updated when real data loads
      email: user.email,
      profilePicture: user.picture || "", // Use Auth0 picture as fallback
      rating: 5.0,
      firstName: user.given_name || "Driver",
      lastName: user.family_name || "User",
      connectedAccount: "",
    }

    return <DriverHomescreen userData={defaultUserData} isLoadingUserData={checkingUser} />
  }

  // This should never be reached
  return <LoginScreen />
}
