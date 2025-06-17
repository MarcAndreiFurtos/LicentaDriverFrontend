"use client"

import Auth0ProviderWrapper from "../lib/auth0-provider"
import AuthWrapper from "../components/auth-wrapper"

export default function Page() {
  return (
    <Auth0ProviderWrapper>
      <AuthWrapper />
    </Auth0ProviderWrapper>
  )
}
