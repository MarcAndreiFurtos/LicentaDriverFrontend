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
  Loader2,
  AlertCircle,
  ExternalLink,
  CreditCard,
  Plus,
  LogOut,
  MapPin,
  Package,
} from "lucide-react"
import { useAuth0 } from "@auth0/auth0-react"
import GoogleMap from "./components/google-map"
import AddCardView from "./components/add-card-view"
import ProfilePictureUpload from "./components/profile-picture-upload"
import { apiCall } from "./lib/api-config"
// @ts-ignore
import type { google } from "googlemaps"
import PickupInProgress from "./components/pickup-in-progress"
import CardSelectionPopup from "./components/card-selection-popup"

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

interface SgrPickupDto {
  driverLocation: string
  pickupLocation: string
  sackSizeLiters: number
  userId: number
  driverId: number
  cardId: number
  value: number
}

interface PendingPickupDto {
  id: number
  driverLocation: string
  pickupLocation: string
  value: number
  userId: number
  driverId: number
  cardId: number
}

interface PickupLocation {
  id: string
  lat: number
  lng: number
  address: string
  value: number
}

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
  const [pastDeliveries, setPastDeliveries] = useState<SgrPickupDto[]>([])
  const [loadingDeliveries, setLoadingDeliveries] = useState(false)
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null)
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([])
  const [loadingPickups, setLoadingPickups] = useState(false)
  const [pickupsError, setPickupsError] = useState<string | null>(null)
  const [showPickupInProgress, setShowPickupInProgress] = useState(false)
  const [activePickup, setActivePickup] = useState<PickupLocation | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string>("")
  const [showCardSelection, setShowCardSelection] = useState(false)
  const [pendingPickup, setPendingPickup] = useState<PickupLocation | null>(null)
  const { logout, user } = useAuth0()

  // Update user data when it loads
  useEffect(() => {
    if (userData.id !== 0) {
      setCurrentUserData(userData)
      // Fetch connected account info when we have a real user ID
      fetchConnectedAccount(userData.id)
      // Fetch past deliveries
      fetchPastDeliveries(userData.id)
    }
    // Fetch pending pickups regardless of user data
    fetchPendingPickups()
  }, [userData])

  // Set up polling for pending pickups
  useEffect(() => {
    // Initial fetch
    fetchPendingPickups()

    // Set up polling every 30 seconds
    const pollInterval = setInterval(() => {
      fetchPendingPickups()
    }, 30000) // 30 seconds

    // Cleanup interval on unmount
    return () => {
      clearInterval(pollInterval)
    }
  }, [])

  // Function to convert address to coordinates using Google Geocoding API
  const getCoordinatesFromAddress = async (address: string): Promise<{ lat: number; lng: number }> => {
    try {
      // Check if Google Maps is loaded
      if (!window.google || !window.google.maps) {
        console.warn("Google Maps not loaded yet, using default coordinates")
        return {
          lat: 45.7489,
          lng: 21.2087,
        }
      }

      // Use Google Geocoding API
      const geocoder = new window.google.maps.Geocoder()

      return new Promise((resolve, reject) => {
        geocoder.geocode(
          { address: address },
          (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
            if (status === "OK" && results && results[0]) {
              const location = results[0].geometry.location
              resolve({
                lat: location.lat(),
                lng: location.lng(),
              })
            } else {
              console.error("Geocoding failed for address:", address, "Status:", status)
              // Return default Timisoara coordinates if geocoding fails
              resolve({
                lat: 45.7489,
                lng: 21.2087,
              })
            }
          },
        )
      })
    } catch (error) {
      console.error("Error geocoding address:", address, error)
      // Return default Timisoara coordinates if geocoding fails
      return {
        lat: 45.7489,
        lng: 21.2087,
      }
    }
  }

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

  const fetchPastDeliveries = async (userId: number) => {
    if (userId === 0) return // Don't fetch for placeholder user

    setLoadingDeliveries(true)
    setDeliveriesError(null)
    try {
      console.log(`Fetching past deliveries for user ID: ${userId}`)
      const response = await apiCall(`/api/sgrPickup/${userId}/historyDriver`, {
        method: "GET",
      })

      if (response.ok) {
        const deliveries = await response.json()
        console.log("Fetched past deliveries:", deliveries)
        setPastDeliveries(deliveries || [])
      } else {
        console.error("Failed to fetch past deliveries:", response.status)
        const errorText = await response.text()
        setDeliveriesError(`Failed to load delivery history: ${response.status}`)
        setPastDeliveries([])
      }
    } catch (error) {
      console.error("Error fetching past deliveries:", error)
      setDeliveriesError("Unable to load delivery history. Please check your connection.")
      setPastDeliveries([])
    } finally {
      setLoadingDeliveries(false)
    }
  }

  const fetchPendingPickups = async () => {
    // Don't show loading on subsequent polls to avoid UI flicker
    const isInitialLoad = pickupLocations.length === 0
    if (isInitialLoad) {
      setLoadingPickups(true)
    }
    setPickupsError(null)

    try {
      console.log("Fetching pending pickups...")
      const response = await apiCall("/api/sgrPickup/pending", {
        method: "GET",
      })

      if (response.ok) {
        const pendingPickups: PendingPickupDto[] = await response.json()
        console.log("Fetched pending pickups:", pendingPickups)

        if (pendingPickups.length === 0) {
          console.log("No pending pickups found")
          setPickupLocations([])
          return
        }

        // Convert pending pickups to pickup locations with coordinates
        const locationsWithCoords: PickupLocation[] = []

        for (const pickup of pendingPickups) {
          try {
            console.log(`Getting coordinates for pickup ${pickup.id}: ${pickup.pickupLocation}`)
            const coords = await getCoordinatesFromAddress(pickup.pickupLocation)
            console.log(`Coordinates for pickup ${pickup.id}:`, coords)

            locationsWithCoords.push({
              id: pickup.id.toString(),
              lat: coords.lat,
              lng: coords.lng,
              address: pickup.pickupLocation,
              value: pickup.value,
            })
          } catch (error) {
            console.error("Error getting coordinates for pickup:", pickup.id, error)
            // Add with default coordinates if geocoding fails
            locationsWithCoords.push({
              id: pickup.id.toString(),
              lat: 45.7489,
              lng: 21.2087,
              address: pickup.pickupLocation,
              value: pickup.value,
            })
          }
        }

        console.log("Final pickup locations with coordinates:", locationsWithCoords)
        setPickupLocations(locationsWithCoords)
      } else {
        console.error("Failed to fetch pending pickups:", response.status)
        const errorText = await response.text()
        console.error("Error response:", errorText)
        setPickupsError(`Failed to load pending pickups: ${response.status}`)
        setPickupLocations([])
      }
    } catch (error) {
      console.error("Error fetching pending pickups:", error)
      setPickupsError("Unable to load pending pickups. Please check your connection.")
      setPickupLocations([])
    } finally {
      if (isInitialLoad) {
        setLoadingPickups(false)
      }
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

  const handleStartPickup = async (pickup: PickupLocation) => {
    if (!currentLocation) {
      setAccountError("Unable to get your current location. Please enable location services.")
      return
    }

    if (currentUserData.id === 0) {
      setAccountError("Please wait for your profile to load.")
      return
    }

    // Store the pickup and show card selection popup
    setPendingPickup(pickup)
    setShowCardSelection(true)
  }

  const handleCardSelected = async (cardId: string) => {
    setShowCardSelection(false)
    setSelectedCardId(cardId)

    // Validate all required data
    if (!pendingPickup) {
      setAccountError("No pickup selected.")
      return
    }

    if (!currentLocation) {
      setAccountError("Unable to get your current location. Please enable location services.")
      return
    }

    if (!cardId || cardId === "") {
      setAccountError("No card selected.")
      return
    }

    if (currentUserData.id === 0) {
      setAccountError("User data not loaded yet. Please wait.")
      return
    }

    // Validate cardId is a valid number
    const parsedCardId = Number.parseInt(cardId, 10)
    if (isNaN(parsedCardId) || parsedCardId <= 0) {
      setAccountError(`Invalid card ID: ${cardId}`)
      return
    }

    try {
      const startPickupData = {
        driverLocation: `${currentLocation.lat},${currentLocation.lng}`,
        pickupLocation: pendingPickup.address,
        userId: currentUserData.id,
        driverId: currentUserData.id,
        cardId: parsedCardId, // Use the card's ID as the cardId
      }

      console.log("=== PICKUP START DEBUG INFO ===")
      console.log("Pickup ID:", pendingPickup.id)
      console.log("Pickup Address:", pendingPickup.address)
      console.log("Driver Location:", `${currentLocation.lat},${currentLocation.lng}`)
      console.log("User ID:", currentUserData.id)
      console.log("Card ID (original string):", cardId)
      console.log("Card ID (parsed integer):", parsedCardId)
      console.log("Full request data:", JSON.stringify(startPickupData, null, 2))
      console.log("API endpoint:", `/api/sgrPickup/${pendingPickup.id}/progress`)
      console.log("=== END DEBUG INFO ===")

      const response = await apiCall(`/api/sgrPickup/${pendingPickup.id}/progress`, {
        method: "PUT",
        body: JSON.stringify(startPickupData),
      })

      if (response.ok) {
        console.log("✅ Pickup started successfully")
        setActivePickup(pendingPickup)
        setShowPickupInProgress(true)
        setPendingPickup(null)
      } else {
        let errorDetails = ""
        try {
          const contentType = response.headers.get("content-type")
          if (contentType && contentType.includes("application/json")) {
            const errorJson = await response.json()
            errorDetails = JSON.stringify(errorJson, null, 2)
          } else {
            errorDetails = await response.text()
          }
        } catch (parseError) {
          errorDetails = `Unable to parse error response: ${parseError}`
        }

        console.error("❌ Failed to start pickup")
        console.error("Response status:", response.status)
        console.error("Error details:", errorDetails)
        setAccountError(`Failed to start pickup (${response.status}): ${errorDetails}`)
      }
    } catch (error) {
      console.error("❌ Network error starting pickup:", error)
      setAccountError(error instanceof Error ? error.message : "Network error occurred")
    }
  }

  const handleCardSelectionClose = () => {
    setShowCardSelection(false)
    setPendingPickup(null)
  }

  const handlePickupComplete = () => {
    setShowPickupInProgress(false)
    setActivePickup(null)
    setSelectedCardId("")
    // Refresh pending pickups
    fetchPendingPickups()
  }

  // Show Card Selection Popup
  if (showCardSelection && currentUserData.id !== 0) {
    return (
      <>
        {/* Render the main screen in the background */}
        <div className="relative h-screen w-full bg-gray-100 overflow-hidden">
          <div className="absolute inset-0">
            <GoogleMap
              zoom={15}
              pickupLocations={pickupLocations}
              onLocationUpdate={handleLocationUpdate}
              onStartPickup={handleStartPickup}
            />
          </div>
          {/* Other UI elements would be here but simplified for the popup */}
        </div>

        {/* Card Selection Popup */}
        <CardSelectionPopup
          userId={currentUserData.id}
          onCardSelected={handleCardSelected}
          onClose={handleCardSelectionClose}
        />
      </>
    )
  }

  // Show Pickup In Progress view if requested
  if (showPickupInProgress && activePickup) {
    return (
      <PickupInProgress
        userData={currentUserData}
        pickup={activePickup}
        cardId={selectedCardId}
        onBack={handlePickupComplete}
      />
    )
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
        <GoogleMap
          zoom={15}
          pickupLocations={pickupLocations}
          onLocationUpdate={handleLocationUpdate}
          onStartPickup={handleStartPickup}
        />
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

              {/* Past Deliveries Section */}
              <div className="flex-1 py-4 overflow-y-auto">
                <div className="px-4 mb-3">
                  <h4 className="font-semibold text-gray-900 mb-2">Past Deliveries</h4>

                  {loadingDeliveries && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-sm text-gray-500">Loading deliveries...</span>
                    </div>
                  )}

                  {deliveriesError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{deliveriesError}</AlertDescription>
                    </Alert>
                  )}

                  {!loadingDeliveries && !deliveriesError && pastDeliveries.length === 0 && (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">You have not made any pickups yet</p>
                    </div>
                  )}

                  {!loadingDeliveries && pastDeliveries.length > 0 && (
                    <div className="space-y-3">
                      {pastDeliveries.map((delivery, index) => (
                        <Card key={index} className="bg-white border border-gray-200">
                          <CardContent className="p-3">
                            <div className="space-y-2">
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-600 mb-1">Pickup Location</p>
                                  <p className="text-sm font-medium text-gray-900 break-words">
                                    {delivery.pickupLocation}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-green-600 flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-gray-600">Value</p>
                                  <p className="text-sm font-medium text-gray-900">${delivery.value || "0.00"}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
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
          {pickupLocations.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {pickupLocations.length} pickup{pickupLocations.length !== 1 ? "s" : ""}
            </Badge>
          )}
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

          {/* Pending Pickups Loading/Error */}
          {loadingPickups && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription className="text-sm">Loading pending pickups...</AlertDescription>
            </Alert>
          )}

          {pickupsError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{pickupsError}</AlertDescription>
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
