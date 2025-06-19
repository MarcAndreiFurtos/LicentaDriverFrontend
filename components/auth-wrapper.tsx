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
      checkUserExists(user.email)
    }
  }, [isAuthenticated, user?.email, userExists, checkingUser])

  const hexToBase64Image = (hexString: string): string => {
    try {
      console.log("Converting hex to base64. Hex length:", hexString.length)

      if (hexString.length % 2 !== 0) {
        console.error("Invalid hex string length:", hexString.length)
        throw new Error("Invalid hex string length")
      }

      const bytes = new Uint8Array(hexString.length / 2)
      for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = Number.parseInt(hexString.substr(i, 2), 16)
      }

      console.log("Converted to", bytes.length, "bytes")

      const totalPixels = bytes.length / 3
      const dimension = Math.sqrt(totalPixels)
      const width = Math.floor(dimension)
      const height = Math.floor(dimension)

      console.log("Calculated dimensions:", width, "x", height)

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        throw new Error("Could not get canvas context")
      }

      const imageData = ctx.createImageData(width, height)
      for (let i = 0; i < width * height; i++) {
        const rgbIndex = i * 3
        const pixelIndex = i * 4

        if (rgbIndex + 2 < bytes.length) {
          imageData.data[pixelIndex] = bytes[rgbIndex]
          imageData.data[pixelIndex + 1] = bytes[rgbIndex + 1]
          imageData.data[pixelIndex + 2] = bytes[rgbIndex + 2]
          imageData.data[pixelIndex + 3] = 255
        }
      }

      ctx.putImageData(imageData, 0, 0)

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

        let profilePicture = ""

        if (
          backendUserData.profilePicture &&
          backendUserData.profilePicture.trim() !== "" &&
          backendUserData.profilePicture !== "null" &&
          backendUserData.profilePicture !== null
        ) {
          if (backendUserData.profilePicture.startsWith("data:image/")) {
            profilePicture = backendUserData.profilePicture
          } else if (
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
          } else if (backendUserData.profilePicture.startsWith("http")) {
            profilePicture = backendUserData.profilePicture
          } else {
            console.log("Backend profile picture format not recognized, using Auth0 picture")
            profilePicture = user?.picture || ""
          }
        } else {
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
        setUserExists(false)
      }
    } catch (error) {
      console.error("Error checking user:", error)
      setUserExists(false)
    } finally {
      setCheckingUser(false)
    }
  }

  const handleRegistrationComplete = () => {
    if (user?.email) {
      setUserExists(null)
      setUserData(null)
      checkUserExists(user.email)
    }
  }

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

  if (userExists === false && user?.email) {
    return <UserRegistration email={user.email} onRegistrationComplete={handleRegistrationComplete} />
  }

  if (userExists === true && userData) {
    return <DriverHomescreen userData={userData} />
  }

  if (isAuthenticated && user?.email) {
    const defaultUserData: User = {
      id: 0,
      email: user.email,
      profilePicture: user.picture || "",
      rating: 5.0,
      firstName: user.given_name || "Driver",
      lastName: user.family_name || "User",
      connectedAccount: "",
    }

    return <DriverHomescreen userData={defaultUserData} isLoadingUserData={checkingUser} />
  }

  return <LoginScreen />
}
