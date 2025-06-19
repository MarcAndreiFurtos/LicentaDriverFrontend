"use client"

import { Auth0Provider } from "@auth0/auth0-react"
import type { ReactNode } from "react"

interface Auth0ProviderWrapperProps {
  children: ReactNode
}

export default function Auth0ProviderWrapper({ children }: Auth0ProviderWrapperProps) {
  const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN || "dev-kotvcrcjprj3uksp.us.auth0.com"
  const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || "HDOLkDs1fTI88EG6TODypOHIBlAzpddA"
  const redirectUri = typeof window !== "undefined" ? window.location.origin : ""

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      {children}
    </Auth0Provider>
  )
}
