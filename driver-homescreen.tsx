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
  DollarSign,
  Clock,
  Navigation,
  Star,
  Settings,
  HelpCircle,
  LogOut,
  Truck,
  Loader2,
  AlertCircle,
  ExternalLink,
  CreditCard,
  Plus,
} from "lucide-react"
import { useAuth0 } from "@auth0/auth0-react"
import GoogleMap from "./components/google-map"
import AddCardView from "./components/add-card-view"
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
  const { logout, user } = useAuth0()

  // Update user data when it loads
  useEffect(() => {
    if (userData.id !== 0) {
      setCurrentUserData(userData)
      // Fetch connected account info when we have a real user ID
      fetchConnectedAccount(userData.id)
    }
  }, [userData])

  // San Francisco coordinates
  const mapCenter = { lat: 37.7849, lng: -122.4084 }

  const fetchConnectedAccount = async (userId: number) => {
    if (userId === 0) return // Don't fetch for placeholder user

    setLoadingAccount(true)
    try {
      const response = await apiCall(`/api/users/${userId}`, {
        method: "GET",
      })

      if (response.ok) {
        const userData = await response.json()
        setConnectedAccount(userData.connectedAccount || "")
        console.log("Connected account:", userData.connectedAccount)
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
    logout({ logoutParams: { returnTo: window.location.origin } })
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

  // Show Add Card view if requested
  if (showAddCard) {
    return <AddCardView userData={currentUserData} onBack={() => setShowAddCard(false)} />
  }

  return (
    <div className="relative h-screen w-full max-w-sm mx-auto bg-gray-100 overflow-hidden">
      {/* Google Maps Background */}
      <div className="absolute inset-0">
        <GoogleMap center={mapCenter} zoom={15} pickupLocations={pickupLocations} />
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
                <Avatar className="w-16 h-16">
                  <AvatarImage src={currentUserData.profilePicture || user?.picture || "/placeholder.svg"} />
                  <AvatarFallback>
                    {currentUserData.firstName[0]}
                    {currentUserData.lastName[0]}
                  </AvatarFallback>
                </Avatar>
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
                </div>
              </div>

              <div className="flex-1 py-4">
                <div className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <DollarSign className="w-5 h-5" />
                    Earnings
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <Clock className="w-5 h-5" />
                    Trip History
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <Truck className="w-5 h-5" />
                    Vehicle Info
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <Settings className="w-5 h-5" />
                    Settings
                  </Button>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <HelpCircle className="w-5 h-5" />
                    Help
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <Button variant="ghost" className="w-full justify-start gap-3 text-red-600" onClick={handleLogout}>
                  <LogOut className="w-5 h-5" />
                  Sign Out
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

        <Button variant="ghost" size="icon" className="rounded-full">
          <Settings className="w-6 h-6" />
        </Button>
      </div>

      {/* Connected Account Card */}
      <div className="relative z-10 mx-4 mt-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <CreditCard className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 mb-1">Connected Account</p>
                <div className="flex items-center gap-2">
                  {loadingAccount && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  <p
                    className={`text-sm font-medium break-all ${
                      connectedAccount === "" || !connectedAccount ? "text-gray-500 italic" : "text-gray-900 font-mono"
                    }`}
                  >
                    {getAccountDisplayText()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {accountError && (
        <div className="relative z-10 mx-4 mt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{accountError}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Create Connected Account Button */}
      <div className="relative z-10 mx-4 mt-4">
        <Button
          onClick={handleCreateConnectedAccount}
          disabled={isCreatingAccount || (currentUserData.id === 0 && isLoadingUserData)}
          className="w-full h-16 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {isCreatingAccount ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Creating Account...
            </>
          ) : currentUserData.id === 0 && isLoadingUserData ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading Profile...
            </>
          ) : (
            <>
              <ExternalLink className="w-5 h-5 mr-2" />
              Create Connected Account
            </>
          )}
        </Button>
      </div>

      {/* Add Debit Card Button */}
      <div className="relative z-10 mx-4 mt-4">
        <Button
          onClick={() => setShowAddCard(true)}
          disabled={currentUserData.id === 0 && isLoadingUserData}
          className="w-full h-16 text-lg font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
        >
          {currentUserData.id === 0 && isLoadingUserData ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading Profile...
            </>
          ) : (
            <>
              <Plus className="w-5 h-5 mr-2" />
              Add Debit Card
            </>
          )}
        </Button>
      </div>

      {/* Center Location Button */}
      <div className="absolute bottom-6 right-4 z-10">
        <Button
          size="icon"
          className="rounded-full bg-white shadow-lg hover:bg-gray-50"
          onClick={() => {
            // Center map on current location
            if (window.google) {
              console.log("Centering map on current location")
            }
          }}
        >
          <Navigation className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )
}
