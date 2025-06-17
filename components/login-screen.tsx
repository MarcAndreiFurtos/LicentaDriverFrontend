"use client"

import { useAuth0 } from "@auth0/auth0-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Recycle, Truck } from "lucide-react"

export default function LoginScreen() {
  const { loginWithRedirect, isLoading } = useAuth0()

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
          <CardTitle className="text-2xl font-bold text-gray-900">EcoDriver</CardTitle>
          <CardDescription className="text-gray-600">
            Sign in to start collecting recyclables and earning money
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => loginWithRedirect()}
            disabled={isLoading}
            className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            {isLoading ? "Loading..." : "Sign In with Auth0"}
          </Button>
          <div className="text-center text-sm text-gray-500">New driver? Sign up to get started</div>
        </CardContent>
      </Card>
    </div>
  )
}
