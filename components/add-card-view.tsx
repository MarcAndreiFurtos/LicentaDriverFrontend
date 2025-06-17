"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, CreditCard, Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { useAuth0 } from "@auth0/auth0-react"
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

interface AddCardViewProps {
  userData: User
  onBack: () => void
}

// Your Stripe publishable key
const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51RTPNgFawibChNbgqRpgSKarzJlRdDAuGsmxmy13gZFuhkj4UfMilv4Agx2yr3n5eg6pOnwK1xDjAhcJlpj5kSmq003sVhDP08"

// Declare Stripe global
declare global {
  interface Window {
    Stripe: any
  }
}

export default function AddCardView({ userData, onBack }: AddCardViewProps) {
  const { user } = useAuth0()
  const [formData, setFormData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvc: "",
    phoneNumber: "",
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [stripeLoaded, setStripeLoaded] = useState(false)

  useEffect(() => {
    // Load Stripe.js
    const script = document.createElement("script")
    script.src = "https://js.stripe.com/v3/"
    script.async = true
    script.onload = () => {
      setStripeLoaded(true)
    }
    document.head.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  const handleInputChange = (field: string, value: string) => {
    let formattedValue = value

    // Format card number with spaces
    if (field === "cardNumber") {
      formattedValue = value
        .replace(/\s/g, "")
        .replace(/(.{4})/g, "$1 ")
        .trim()
      if (formattedValue.length > 19) return // Max 16 digits + 3 spaces
    }

    // Format expiry date as MM/YY
    if (field === "expiryDate") {
      formattedValue = value.replace(/\D/g, "").replace(/(\d{2})(\d)/, "$1/$2")
      if (formattedValue.length > 5) return // Max MM/YY
    }

    // Format CVC (3-4 digits)
    if (field === "cvc") {
      formattedValue = value.replace(/\D/g, "")
      if (formattedValue.length > 4) return
    }

    // Format phone number
    if (field === "phoneNumber") {
      formattedValue = value.replace(/\D/g, "")
      if (formattedValue.length > 15) return
    }

    setFormData((prev) => ({
      ...prev,
      [field]: formattedValue,
    }))
  }

  const createStripeToken = async (cardData: any) => {
    if (!window.Stripe || !stripeLoaded) {
      throw new Error("Stripe is not loaded")
    }

    const stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY)

    const { token, error } = await stripe.createToken("card", cardData)

    if (error) {
      throw new Error(error.message)
    }

    return token
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    setError(null)
    setSuccess(false)

    try {
      // Validate form
      if (!formData.cardNumber || !formData.expiryDate || !formData.cvc || !formData.phoneNumber) {
        throw new Error("Please fill in all fields")
      }

      const cardNumber = formData.cardNumber.replace(/\s/g, "")
      if (cardNumber.length < 13 || cardNumber.length > 19) {
        throw new Error("Please enter a valid card number")
      }

      const [month, year] = formData.expiryDate.split("/")
      if (!month || !year || month.length !== 2 || year.length !== 2) {
        throw new Error("Please enter a valid expiry date (MM/YY)")
      }

      if (formData.cvc.length < 3 || formData.cvc.length > 4) {
        throw new Error("Please enter a valid CVC")
      }

      if (!stripeLoaded) {
        throw new Error("Stripe is still loading. Please try again.")
      }

      console.log("Step 1: Creating Stripe token...")

      // Step 1: Tokenize card information using Stripe
      const cardData = {
        number: cardNumber,
        exp_month: Number.parseInt(month),
        exp_year: Number.parseInt(`20${year}`),
        cvc: formData.cvc,
      }

      const token = await createStripeToken(cardData)
      console.log("Token created:", token.id)

      // Step 2: Create Stripe customer
      console.log("Step 2: Creating Stripe customer...")

      const customerData = new URLSearchParams({
        name: `${userData.firstName} ${userData.lastName}`,
        email: userData.email,
        phone: formData.phoneNumber,
        description: "Customer created via driver app",
      })

      const customerResponse = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: customerData,
      })

      if (!customerResponse.ok) {
        const errorText = await customerResponse.text()
        console.error("Customer creation failed:", errorText)
        throw new Error(`Failed to create customer: ${customerResponse.status}`)
      }

      const customerResult = await customerResponse.json()
      const accountId = customerResult.id
      console.log("Customer created with ID:", accountId)

      // Step 3: Create payment method
      console.log("Step 3: Creating payment method...")

      const paymentMethodData = new URLSearchParams({
        type: "card",
        "card[token]": token.id,
      })

      const paymentMethodResponse = await fetch("https://api.stripe.com/v1/payment_methods", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: paymentMethodData,
      })

      if (!paymentMethodResponse.ok) {
        const errorText = await paymentMethodResponse.text()
        console.error("Payment method creation failed:", errorText)
        throw new Error(`Failed to create payment method: ${paymentMethodResponse.status}`)
      }

      const paymentMethodResult = await paymentMethodResponse.json()
      const cardId = paymentMethodResult.id
      console.log("Payment method created with ID:", cardId)

      // Step 4: Send to backend
      console.log("Step 4: Sending to backend...")

      const backendData = {
        cardNumber: cardId,
        cardholderName: `${userData.firstName} ${userData.lastName}`,
        accountId: accountId,
        userId: userData.id,
      }

      const backendResponse = await apiCall("/api/cards/tokenize", {
        method: "POST",
        body: JSON.stringify(backendData),
      })

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text()
        console.error("Backend request failed:", errorText)
        throw new Error(`Backend request failed: ${backendResponse.status}`)
      }

      const backendResult = await backendResponse.json()
      console.log("Backend response:", backendResult)

      setSuccess(true)
      setTimeout(() => {
        onBack()
      }, 2000)
    } catch (error) {
      console.error("Error processing card:", error)
      setError(error instanceof Error ? error.message : "An unexpected error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Card Added Successfully!</h2>
            <p className="text-gray-600">Your debit card has been securely added to your account.</p>
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
          <h1 className="text-xl font-semibold text-gray-900">Add Debit Card</h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">Add Your Card</CardTitle>
            <CardDescription className="text-gray-600">Securely add your debit card for payments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!stripeLoaded && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>Loading Stripe security components...</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  type="text"
                  value={formData.cardNumber}
                  onChange={(e) => handleInputChange("cardNumber", e.target.value)}
                  placeholder="1234 5678 9012 3456"
                  required
                  disabled={!stripeLoaded}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="text"
                    value={formData.expiryDate}
                    onChange={(e) => handleInputChange("expiryDate", e.target.value)}
                    placeholder="MM/YY"
                    required
                    disabled={!stripeLoaded}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input
                    id="cvc"
                    type="text"
                    value={formData.cvc}
                    onChange={(e) => handleInputChange("cvc", e.target.value)}
                    placeholder="123"
                    required
                    disabled={!stripeLoaded}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                  placeholder="1234567890"
                  required
                  disabled={!stripeLoaded}
                />
              </div>

              <Button
                type="submit"
                disabled={isProcessing || !stripeLoaded}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing Card...
                  </>
                ) : !stripeLoaded ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Loading Stripe...
                  </>
                ) : (
                  "Add Card"
                )}
              </Button>
            </form>

            <div className="text-xs text-gray-500 text-center">
              <p>🔒 Your card information is encrypted and secure</p>
              <p>Powered by Stripe</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
