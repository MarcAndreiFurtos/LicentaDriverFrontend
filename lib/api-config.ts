export const API_CONFIG = {
  development: {
    baseUrl: "https://licentabackend-f2dpe8f5fjh8bff4.germanywestcentral-01.azurewebsites.net:8080",
    timeout: 10000,
    selfSignedCert: false,
  },
  production: {
    baseUrl: "https://licentabackend-f2dpe8f5fjh8bff4.germanywestcentral-01.azurewebsites.net:8080",
    timeout: 10000,
    selfSignedCert: false,
  },
}

export const getApiConfig = () => {
  const env = process.env.NODE_ENV || "development"
  return API_CONFIG[env as keyof typeof API_CONFIG] || API_CONFIG.development
}

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
    console.error(`API call failed for ${endpoint}:`, error)
    throw error
  }
}

export const testBackendConnection = async () => {
  try {
    const config = getApiConfig()
    const response = await fetch(`${config.baseUrl}/api/users`, {
      method: "OPTIONS",
      mode: "cors",
    })
    return { success: true, status: response.status }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
