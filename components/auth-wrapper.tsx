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

  const checkUserExists = async (email: string) => {
    setCheckingUser(true)
    try {
      const response = await apiCall(`/api/users/email/${encodeURIComponent(email)}`, {
        method: "GET",
      })

      if (response.status === 200) {
        const userData = await response.json()
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
      profilePicture: user.picture || "",
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
