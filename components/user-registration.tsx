"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth0 } from "@auth0/auth0-react"
import { Recycle, Truck, AlertCircle, ExternalLink, Settings } from "lucide-react"
import { apiCall } from "@/lib/api-config"
import ConnectionTest from "./connection-test"

interface UserRegistrationProps {
  email: string
  onRegistrationComplete: () => void
}

export default function UserRegistration({ email, onRegistrationComplete }: UserRegistrationProps) {
  const { user } = useAuth0()
  const [formData, setFormData] = useState({
    firstName: user?.given_name || "",
    lastName: user?.family_name || "",
    email: email,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConnectionTest, setShowConnectionTest] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await apiCall("/api/users", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log("Registration successful:", result)
        onRegistrationComplete()
      } else {
        const errorText = await response.text()
        console.error("Registration failed:", response.status, errorText)
        setError(`Registration failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error("Registration error:", error)

      if (error instanceof TypeError && error.message.includes("fetch")) {
        setError("Unable to connect to the backend server. Please check your internet connection.")
        setShowConnectionTest(true)
      } else {
        setError("An unexpected error occurred. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleAcceptCertificate = () => {
    window.open(
      "https://licentabackend-f2dpe8f5fjh8bff4.germanywestcentral-01.azurewebsites.net:8080/api/users",
      "_blank",
    )
  }

  if (showConnectionTest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="space-y-4">
          <ConnectionTest />
          <Button variant="outline" onClick={() => setShowConnectionTest(false)} className="w-full">
            Back to Registration
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <div className="relative">
              <Recycle className="w-8 h-8 text-green-600" />
              <Truck className="w-4 h-4 text-green-600 absolute -bottom-1 -right-1" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Complete Your Profile</CardTitle>
          <CardDescription className="text-gray-600">
            Please provide your information to create your driver account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>{error}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleAcceptCertificate}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Test Backend
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowConnectionTest(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Test Connection
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                required
                placeholder="Enter your first name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                required
                placeholder="Enter your last name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
                placeholder="Enter your email address"
                disabled
                className="bg-gray-50"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {isSubmitting ? "Creating Account..." : "Register Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
