export const API_CONFIG = {
  development: {
    // Keep HTTPS since your Spring Boot server is configured for it
    baseUrl: "https://localhost:8443",
    timeout: 10000,
    // Flag to indicate if we're dealing with self-signed certificates
    selfSignedCert: true,
  },
  production: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "https://your-production-api.com",
    timeout: 10000,
    selfSignedCert: false,
  },
}

export const getApiConfig = () => {
  const env = process.env.NODE_ENV || "development"
  return API_CONFIG[env as keyof typeof API_CONFIG] || API_CONFIG.development
}

// Helper function for making API calls with consistent configuration
export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const config = getApiConfig()
  const url = `${config.baseUrl}${endpoint}`

  const defaultOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    mode: "cors",
    credentials: "omit",
  }

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  }

  try {
    console.log(`Making API call to: ${url}`)
    console.log(`Method: ${mergedOptions.method || "GET"}`)
    if (mergedOptions.body) {
      console.log(`Body: ${mergedOptions.body}`)
    }

    const response = await fetch(url, mergedOptions)
    console.log(`API response status: ${response.status}`)
    return response
  } catch (error) {
    if (config.selfSignedCert && error instanceof TypeError) {
      console.error(
        `
        SSL Certificate Error: Your Spring Boot backend is using a self-signed certificate.
        
        To fix this:
        1. Visit https://localhost:8443/api/stripe/${endpoint.split("/").pop()} in your browser to accept the certificate
        2. Or add CORS configuration to your Spring Boot application
        3. Or configure your Spring Boot app to use HTTP for development
        
        Original error:`,
        error,
      )
    } else {
      console.error(`API call failed for ${endpoint}:`, error)
    }
    throw error
  }
}

// Test function to check if backend is accessible
export const testBackendConnection = async () => {
  try {
    const config = getApiConfig()
    // Try to hit a simple endpoint to test connectivity
    const response = await fetch(`${config.baseUrl}/api/users`, {
      method: "OPTIONS", // Use OPTIONS to test CORS
      mode: "cors",
    })
    return { success: true, status: response.status }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
