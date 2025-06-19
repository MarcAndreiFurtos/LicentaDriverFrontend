"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
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
  onCardAdded?: (cardId: string) => void
}

const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51RTPNgFawibChNbgqRpgSKarzJlRdDAuGsmxmy13gZFuhkj4UfMilv4Agx2yr3n5eg6pOnwK1xDjAhcJlpj5kSmq003sVhDP08"

const STRIPE_SECRET_KEY =
  "sk_test_51RTPNgFawibChNbgnxmPjWiWOZJXvNDlG0LtWoGQbHsRwK8LHGL4A6O3AJ8NfkCqr06qiD2bjTEbFXxbVVGewwS1005HwHJ4RS"

declare global {
  interface Window {
    Stripe: any
  }
}

export default function AddCardView({ userData, onBack, onCardAdded }: AddCardViewProps) {
  const { user } = useAuth0()
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [stripeLoaded, setStripeLoaded] = useState(false)
  const [elementsReady, setElementsReady] = useState(false)
  const [processingStep, setProcessingStep] = useState("")

  const cardElementRef = useRef<HTMLDivElement>(null)
  const stripeRef = useRef<any>(null)
  const elementsRef = useRef<any>(null)
  const cardElementInstanceRef = useRef<any>(null)
  const scriptLoadedRef = useRef(false)

  useEffect(() => {
    if (window.Stripe && !scriptLoadedRef.current) {
      scriptLoadedRef.current = true
      setStripeLoaded(true)
      initializeStripeElements()
      return
    }

    if (!scriptLoadedRef.current) {
      const existingScript = document.querySelector('script[src*="stripe.com/v3"]')
      if (existingScript) {
        existingScript.addEventListener("load", () => {
          if (!scriptLoadedRef.current) {
            scriptLoadedRef.current = true
            setStripeLoaded(true)
            initializeStripeElements()
          }
        })
        return
      }

      const script = document.createElement("script")
      script.src = "https://js.stripe.com/v3/"
      script.async = true
      script.onload = () => {
        if (!scriptLoadedRef.current) {
          scriptLoadedRef.current = true
          setStripeLoaded(true)
          initializeStripeElements()
        }
      }
      document.head.appendChild(script)
    }

    return () => {
      if (cardElementInstanceRef.current) {
        try {
          cardElementInstanceRef.current.destroy()
        } catch (e) {
          console.log("Element already destroyed")
        }
        cardElementInstanceRef.current = null
      }
    }
  }, [])

  const initializeStripeElements = () => {
    if (!window.Stripe || stripeRef.current) return

    try {
      stripeRef.current = window.Stripe(STRIPE_PUBLISHABLE_KEY)

      elementsRef.current = stripeRef.current.elements({
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#2563eb",
            colorBackground: "#ffffff",
            colorText: "#1f2937",
            colorDanger: "#ef4444",
            fontFamily: "system-ui, sans-serif",
            spacingUnit: "4px",
            borderRadius: "6px",
          },
        },
      })

      cardElementInstanceRef.current = elementsRef.current.create("card", {
        style: {
          base: {
            fontSize: "16px",
            color: "#1f2937",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: "400",
            "::placeholder": {
              color: "#9ca3af",
            },
          },
          invalid: {
            color: "#ef4444",
            iconColor: "#ef4444",
          },
          complete: {
            color: "#059669",
            iconColor: "#059669",
          },
        },
        hidePostalCode: true,
      })

      if (cardElementRef.current && cardElementInstanceRef.current) {
        cardElementRef.current.innerHTML = ""

        cardElementInstanceRef.current.mount(cardElementRef.current)

        cardElementInstanceRef.current.on("change", (event: any) => {
          if (event.error) {
            setError(event.error.message)
          } else {
            setError(null)
          }
        })

        cardElementInstanceRef.current.on("ready", () => {
          setElementsReady(true)
        })
      }
    } catch (err) {
      console.error("Error initializing Stripe Elements:", err)
      setError("Failed to initialize payment form. Please refresh and try again.")
    }
  }

  const handlePhoneNumberChange = (value: string) => {
    const formattedValue = value.replace(/\D/g, "")
    if (formattedValue.length <= 15) {
      setPhoneNumber(formattedValue)
    }
  }

  const stripeApiCall = async (endpoint: string, data: any) => {
    const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(data),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    setError(null)
    setProcessingStep("")

    try {
      if (!phoneNumber || phoneNumber.length < 10) {
        throw new Error("Please enter a valid phone number")
      }

      if (!stripeRef.current || !cardElementInstanceRef.current) {
        throw new Error("Stripe is not properly initialized")
      }

      setProcessingStep("Creating customer account...")
      console.log("Step 1: Creating Stripe Customer...")

      const customerData = {
        email: userData.email,
        name: `${userData.firstName} ${userData.lastName}`,
        phone: phoneNumber,
        description: "driver customer",
      }

      const customer = await stripeApiCall("customers", customerData)
      console.log("Stripe Customer created:", customer.id)

      setProcessingStep("Processing card information...")
      console.log("Step 2: Creating payment method with Stripe Elements...")

      const { paymentMethod, error: stripeError } = await stripeRef.current.createPaymentMethod({
        type: "card",
        card: cardElementInstanceRef.current,
        billing_details: {
          name: `${userData.firstName} ${userData.lastName}`,
          email: userData.email,
          phone: phoneNumber,
        },
      })

      if (stripeError) {
        throw new Error(stripeError.message)
      }

      if (!paymentMethod) {
        throw new Error("Failed to create payment method")
      }

      console.log("Payment method created:", paymentMethod.id)

      setProcessingStep("Linking card to account...")
      console.log("Step 3: Attaching payment method to customer...")

      await stripeApiCall(`payment_methods/${paymentMethod.id}/attach`, {
        customer: customer.id,
      })

      console.log("Payment method attached to customer")

      setProcessingStep("Finalizing card setup...")
      console.log("Step 4: Sending to backend...")

      const backendData = {
        cardNumber: paymentMethod.id,
        cardholderName: `${userData.firstName} ${userData.lastName}`,
        accountId: customer.id,
        userId: userData.id,
      }

      const backendResponse = await apiCall("/api/cards/tokenize", {
        method: "POST",
        body: JSON.stringify(backendData),
      })

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text()
        console.error("Backend request failed:", errorText)
        throw new Error(`Backend request failed: ${backendResponse.status} - ${errorText}`)
      }

      const backendResult = await backendResponse.json()
      console.log("Backend response:", backendResult)

      if (backendResult && backendResult.id && onCardAdded) {
        onCardAdded(backendResult.id.toString())
      }

      setSuccess(true)
      setTimeout(() => {
        onBack()
      }, 2000)
    } catch (error) {
      console.error("Error processing card:", error)
      setError(error instanceof Error ? error.message : "An unexpected error occurred")
    } finally {
      setIsProcessing(false)
      setProcessingStep("")
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Card Added Successfully!</h2>
            <p className="text-gray-600">Your debit card has been securely added with customer account.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-md mx-auto">
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

            {stripeLoaded && !elementsReady && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>Initializing secure payment form...</AlertDescription>
              </Alert>
            )}

            {processingStep && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>{processingStep}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="card-element">Card Information</Label>
                <div
                  ref={cardElementRef}
                  className="p-4 border border-gray-300 rounded-md bg-white min-h-[50px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
                  style={{
                    opacity: stripeLoaded && elementsReady ? 1 : 0.5,
                    pointerEvents: stripeLoaded && elementsReady ? "auto" : "none",
                  }}
                />
                {!elementsReady && stripeLoaded && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading card form...</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneNumberChange(e.target.value)}
                  placeholder="1234567890"
                  required
                  disabled={!stripeLoaded}
                />
              </div>

              <Button
                type="submit"
                disabled={isProcessing || !stripeLoaded || !elementsReady}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {processingStep || "Processing Card..."}
                  </>
                ) : !stripeLoaded ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Loading Stripe...
                  </>
                ) : !elementsReady ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Initializing Form...
                  </>
                ) : (
                  "Add Card"
                )}
              </Button>
            </form>

            <div className="text-xs text-gray-500 text-center space-y-1">
              <p>🔒 Your card information is encrypted and secure</p>
              <p>Powered by Stripe Elements</p>
              <p className="text-gray-400">
                Card details are processed securely by Stripe and never stored on our servers
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
