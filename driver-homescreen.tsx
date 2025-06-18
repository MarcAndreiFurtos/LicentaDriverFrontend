"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Menu,
  Navigation,
  Star,
  Loader2,
  AlertCircle,
  ExternalLink,
  CreditCard,
  Plus,
  Clock,
  LogOut,
} from "lucide-react"
import { useAuth0 } from "@auth0/auth0-react"
import GoogleMap from "./components/google-map"
import AddCardView from "./components/add-card-view"
import ProfilePictureUpload from "./components/profile-picture-upload"
import { apiCall } from "./lib/api-config"

interface User {
  id: number
  email: string
  profilePicture: string
  rating: number
  firstName: string
  lastName: string
  connectedAccount: string
}

interface DriverHomescreenProps {
  userData: User
  isLoadingUserData?: boolean
}

interface ConfirmationLinkDto {
  returnUrl: string
  refreshUrl: string
}

const pickupLocations = [
  {
    id: "1",
    lat: 37.7849,
    lng: -122.4094,
    address: "1234 Oak Street, San Francisco, CA",
    customerName: "Sarah Johnson",
    items: ["Plastic bottles", "Aluminum cans"],
    earnings: 15.5,
  },
  {
    id: "2",
    lat: 37.7849,
    lng: -122.4074,
    address: "5678 Pine Avenue, San Francisco, CA",
    customerName: "Mike Chen",
    items: ["Cardboard boxes", "Glass bottles"],
    earnings: 22.75,
  },
  {
    id: "3",
    lat: 37.7829,
    lng: -122.4084,
    address: "9012 Elm Drive, San Francisco, CA",
    customerName: "Lisa Rodriguez",
    items: ["Mixed recyclables"],
    earnings: 18.25,
  },
  {
    id: "4",
    lat: 37.7869,
    lng: -122.4104,
    address: "3456 Maple Court, San Francisco, CA",
    customerName: "David Kim",
    items: ["Electronics", "Batteries"],
    earnings: 35.0,
  },
]

export default function DriverHomescreen({ userData, isLoadingUserData = false }: DriverHomescreenProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [currentUserData, setCurrentUserData] = useState(userData)
  const [connectedAccount, setConnectedAccount] = useState<string>("")
  const [loadingAccount, setLoadingAccount] = useState(false)
  const [showAddCard, setShowAddCard] = useState(false)
  const [showProfileUpload, setShowProfileUpload] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const { logout, user } = useAuth0()

  // Update user data when it loads
  useEffect(() => {
    if (userData.id !== 0) {
      setCurrentUserData(userData)
      // Fetch connected account info when we have a real user ID
      fetchConnectedAccount(userData.id)
    }
  }, [userData])

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

  const fetchConnectedAccount = async (userId: number) => {
    if (userId === 0) return // Don't fetch for placeholder user

    setLoadingAccount(true)
    try {
      const response = await apiCall(`/api/users/${userId}`, {
        method: "GET",
      })

      if (response.ok) {
        const backendUserData = await response.json()
        console.log("Fetched user data for connected account:", backendUserData)
        console.log("Backend profilePicture in fetchConnectedAccount:", backendUserData.profilePicture)

        // Update the connected account
        setConnectedAccount(backendUserData.connectedAccount || "")

        // Update the profile picture if it has changed and is valid
        if (
          backendUserData.profilePicture &&
          backendUserData.profilePicture.trim() !== "" &&
          backendUserData.profilePicture !== "null" &&
          backendUserData.profilePicture !== null
        ) {
          let newProfilePicture = ""

          // Check if it's a base64 data URL
          if (backendUserData.profilePicture.startsWith("data:image/")) {
            newProfilePicture = backendUserData.profilePicture
          }
          // Check if it's a hex string
          else if (
            /^[0-9a-fA-F]+$/.test(backendUserData.profilePicture) &&
            backendUserData.profilePicture.length > 100
          ) {
            try {
              newProfilePicture = hexToBase64Image(backendUserData.profilePicture)
            } catch (error) {
              console.error("Failed to convert hex to image:", error)
              newProfilePicture = currentUserData.profilePicture // Keep current
            }
          }
          // Check if it's a regular URL
          else if (backendUserData.profilePicture.startsWith("http")) {
            newProfilePicture = backendUserData.profilePicture
          }

          if (newProfilePicture && newProfilePicture !== currentUserData.profilePicture) {
            console.log("Updating profile picture from backend")
            setCurrentUserData((prev) => ({
              ...prev,
              profilePicture: newProfilePicture,
            }))
          }
        }

        console.log("Connected account:", backendUserData.connectedAccount)
      } else {
        console.error("Failed to fetch user data:", response.status)
        setConnectedAccount("")
      }
    } catch (error) {
      console.error("Error fetching connected account:", error)
      setConnectedAccount("")
    } finally {
      setLoadingAccount(false)
    }
  }

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    })
  }

  const handleCreateConnectedAccount = async () => {
    // If we don't have a real user ID yet, show error
    if (currentUserData.id === 0) {
      setAccountError("Please wait for your profile to load before creating a connected account.")
      return
    }

    setIsCreatingAccount(true)
    setAccountError(null)

    try {
      console.log(`Creating connected account for user ID: ${currentUserData.id}`)

      // Step 1: Create connected account (POST request with no body)
      // This returns a string (account number), not JSON
      const createAccountResponse = await apiCall(`/api/stripe/${currentUserData.id}`, {
        method: "POST",
      })

      if (!createAccountResponse.ok) {
        throw new Error(`Failed to create account: ${createAccountResponse.status} ${createAccountResponse.statusText}`)
      }

      // Get the account number as a string
      const accountNumber = await createAccountResponse.text()
      console.log("Account created successfully. Account number:", accountNumber)

      // Step 2: Get confirmation link (PUT request with ConfirmationLinkDto)
      const confirmationLinkDto: ConfirmationLinkDto = {
        returnUrl: "https://connect.stripe.com/hosted/setup/c/complete",
        refreshUrl: "https://connect.stripe.com/hosted/setup/c/complete",
      }

      const confirmationResponse = await apiCall(`/api/stripe/${currentUserData.id}`, {
        method: "PUT",
        body: JSON.stringify(confirmationLinkDto),
      })

      if (!confirmationResponse.ok) {
        throw new Error(
          `Failed to get confirmation link: ${confirmationResponse.status} ${confirmationResponse.statusText}`,
        )
      }

      // Get the redirect link as a string
      const redirectUrl = await confirmationResponse.text()
      console.log("Confirmation link received:", redirectUrl)

      // Step 3: Open the confirmation link in a new tab
      if (redirectUrl && redirectUrl.trim()) {
        const cleanUrl = redirectUrl.trim()
        console.log("Opening in new tab:", cleanUrl)
        window.open(cleanUrl, "_blank", "noopener,noreferrer")

        // Refresh the connected account info after a short delay
        setTimeout(() => {
          fetchConnectedAccount(currentUserData.id)
        }, 2000)
      } else {
        throw new Error("No redirect link received from server")
      }
    } catch (error) {
      console.error("Error creating connected account:", error)
      setAccountError(error instanceof Error ? error.message : "An unexpected error occurred")
    } finally {
      setIsCreatingAccount(false)
    }
  }

  const getAccountDisplayText = () => {
    if (loadingAccount) {
      return "Loading account info..."
    }
    if (connectedAccount === "" || !connectedAccount) {
      return "The connected account hasn't been created yet"
    }
    return connectedAccount
  }

  const handleProfilePictureSuccess = (newProfilePicture: string) => {
    // Update the current user data with the new profile picture
    setCurrentUserData((prev) => ({
      ...prev,
      profilePicture: newProfilePicture,
    }))
  }

  const handleLocationUpdate = (location: { lat: number; lng: number }) => {
    setCurrentLocation(location)
    console.log("Location updated:", location)
  }

  const handleCenterLocation = () => {
    // Call the global function exposed by GoogleMap
    if ((window as any).centerOnCurrentLocation) {
      ;(window as any).centerOnCurrentLocation()
    }
  }

  const getProfilePictureUrl = () => {
    console.log("Getting profile picture URL...")
    console.log(
      "currentUserData.profilePicture:",
      currentUserData.profilePicture ? "Set (length: " + currentUserData.profilePicture.length + ")" : "Empty",
    )
    console.log("user?.picture:", user?.picture)

    // Use backend profile picture if it exists and is not empty
    if (
      currentUserData.profilePicture &&
      currentUserData.profilePicture.trim() !== "" &&
      currentUserData.profilePicture !== "null" &&
      currentUserData.profilePicture !== null
    ) {
      console.log("Using backend profile picture")
      return currentUserData.profilePicture
    }

    // Fall back to Auth0 picture if available
    if (user?.picture) {
      console.log("Using Auth0 profile picture:", user.picture)
      return user.picture
    }

    // Use placeholder as last resort
    console.log("Using placeholder profile picture")
    return "/placeholder.svg"
  }

  // Show Profile Upload view if requested
  if (showProfileUpload) {
    return (
      <ProfilePictureUpload
        userData={currentUserData}
        onBack={() => setShowProfileUpload(false)}
        onSuccess={handleProfilePictureSuccess}
      />
    )
  }

  // Show Add Card view if requested
  if (showAddCard) {
    return <AddCardView userData={currentUserData} onBack={() => setShowAddCard(false)} />
  }

  return (
    <div className="relative h-screen w-full bg-gray-100 overflow-hidden">
      {/* Google Maps Background */}
      <div className="absolute inset-0">
        <GoogleMap zoom={15} pickupLocations={pickupLocations} onLocationUpdate={handleLocationUpdate} />
      </div>

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between p-4 bg-white/95 backdrop-blur-sm">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 p-4 border-b">
                <button onClick={() => setShowProfileUpload(true)} className="relative group">
                  <Avatar className="w-16 h-16 cursor-pointer transition-opacity group-hover:opacity-80">
                    <AvatarImage src={getProfilePictureUrl() || "/placeholder.svg"} />
                    <AvatarFallback>
                      {currentUserData.firstName[0]}
                      {currentUserData.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-full transition-all">
                    <span className="text-white text-xs opacity-0 group-hover:opacity-100 font-medium">Edit</span>
                  </div>
                </button>
                <div>
                  <h3 className="font-semibold">
                    {currentUserData.firstName} {currentUserData.lastName}
                    {isLoadingUserData && <Loader2 className="w-3 h-3 ml-1 inline animate-spin" />}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm text-gray-600">{currentUserData.rating}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    ID: {currentUserData.id === 0 ? "Loading..." : currentUserData.id}
                  </p>
                  {currentLocation && (
                    <p className="text-xs text-gray-500">
                      📍 {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-1 py-4">
                <div className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <Clock className="w-5 h-5" />
                    Trip History
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-red-600 hover:bg-red-50 hover:text-red-700 h-12"
                  onClick={handleLogout}
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <Badge variant={isOnline ? "default" : "secondary"} className="bg-green-500">
            {isOnline ? "ONLINE" : "OFFLINE"}
          </Badge>
          {isLoadingUserData && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
        </div>
      </div>

      {/* Centered Control Panel */}
      <div className="relative z-10 flex justify-center mt-4">
        <div className="w-full max-w-md px-4 space-y-3">
          {/* Connected Account Card */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 mb-1">Connected Account</p>
                  <div className="flex items-center gap-2">
                    {loadingAccount && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                    <p
                      className={`text-xs font-medium break-all ${
                        connectedAccount === "" || !connectedAccount
                          ? "text-gray-500 italic"
                          : "text-gray-900 font-mono"
                      }`}
                    >
                      {getAccountDisplayText()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Alert */}
          {accountError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{accountError}</AlertDescription>
            </Alert>
          )}

          {/* Create Connected Account Button */}
          <Button
            onClick={handleCreateConnectedAccount}
            disabled={isCreatingAccount || (currentUserData.id === 0 && isLoadingUserData)}
            className="w-full h-10 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {isCreatingAccount ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Account...
              </>
            ) : currentUserData.id === 0 && isLoadingUserData ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading Profile...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Create Connected Account
              </>
            )}
          </Button>

          {/* Add Debit Card Button */}
          <Button
            onClick={() => setShowAddCard(true)}
            disabled={currentUserData.id === 0 && isLoadingUserData}
            className="w-full h-10 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
          >
            {currentUserData.id === 0 && isLoadingUserData ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading Profile...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add Debit Card
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Center Location Button */}
      <div className="absolute bottom-6 right-4 z-10">
        <Button size="icon" className="rounded-full bg-white shadow-lg hover:bg-gray-50" onClick={handleCenterLocation}>
          <Navigation className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )
}
