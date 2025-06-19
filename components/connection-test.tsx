"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react"
import { testBackendConnection } from "@/lib/api-config"

export default function ConnectionTest() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; status?: number; error?: string } | null>(null)

  const runTest = async () => {
    setTesting(true)
    setResult(null)

    try {
      const testResult = await testBackendConnection()
      setResult(testResult)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setTesting(false)
    }
  }

  const openBackendUrl = () => {
    window.open("https://licenta-backend.westeurope.cloudapp.azure.com:8443/api/users", "_blank")
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Backend Connection Test</CardTitle>
        <CardDescription>Test connectivity to your Spring Boot backend server</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runTest} disabled={testing} className="w-full">
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testing Connection...
            </>
          ) : (
            "Test Backend Connection"
          )}
        </Button>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <AlertDescription>
              {result.success ? (
                <div>
                  <p className="font-medium text-green-600">Connection Successful!</p>
                  <p className="text-sm">Backend responded with status: {result.status}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium">Connection Failed</p>
                  <p className="text-sm">{result.error}</p>
                  <Button variant="outline" size="sm" onClick={openBackendUrl} className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Test Backend Connection
                  </Button>
                  <p className="text-xs text-gray-600">Click above to test the backend connection.</p>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>
            <strong>Backend URL:</strong> https://licenta-backend.westeurope.cloudapp.azure.com:8443
          </p>
          <p>
            <strong>Expected:</strong> Spring Boot server with CORS enabled
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
