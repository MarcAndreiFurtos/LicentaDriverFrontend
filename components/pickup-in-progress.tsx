"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Clock, MapPin, Loader2, AlertCircle, Navigation } from "lucide-react"
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

interface PickupLocation {
  id: string
  lat: number
  lng: number
  address: string
  value: number
}

interface EtaResponse {
  estimatedTime: string
  distance: string
}

interface PickupInProgressProps {
  userData: User
  pickup: PickupLocation
  cardId: string
  onBack: () => void
}

declare global {
  interface Window {
    google: any
  }
}

export default function PickupInProgress({ userData, pickup, cardId, onBack }: PickupInProgressProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [currentAddress, setCurrentAddress] = useState<string>("")
  const [eta, setEta] = useState<EtaResponse | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isLoadingEta, setIsLoadingEta] = useState(true)
  const pickupMarkerRef = useRef<any>(null)
  const driverMarkerRef = useRef<any>(null)
  const watchIdRef = useRef<number | null>(null)
  const etaPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    initializeMap()
    startLocationTracking()
    startEtaPolling()

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (etaPollIntervalRef.current) {
        clearInterval(etaPollIntervalRef.current)
      }
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (currentLocation) {
      convertCoordinatesToAddress(currentLocation.lat, currentLocation.lng)
        .then((address) => {
          setCurrentAddress(address)
          startLocationUpdatePolling(address)
        })
        .catch((error) => {
          console.error("Failed to get address for current location:", error)
          const fallbackAddress = `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`
          setCurrentAddress(fallbackAddress)
          startLocationUpdatePolling(fallbackAddress)
        })
    }
  }, [currentLocation])

  useEffect(() => {
    if (map && currentLocation) {
      updateDriverMarker()
    }
  }, [map, currentLocation])

  const convertCoordinatesToAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      if (!window.google || !window.google.maps) {
        console.warn("Google Maps not loaded yet, using coordinates as address")
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      }

      const geocoder = new window.google.maps.Geocoder()

      return new Promise((resolve, reject) => {
        geocoder.geocode(
          { location: { lat, lng } },
          (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
            if (status === "OK" && results && results[0]) {
              const address = results[0].formatted_address
              console.log(`Converted coordinates (${lat}, ${lng}) to address: ${address}`)
              resolve(address)
            } else {
              console.error("Reverse geocoding failed for coordinates:", lat, lng, "Status:", status)
              resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
            }
          },
        )
      })
    } catch (error) {
      console.error("Error in reverse geocoding:", error)
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
  }

  const initializeMap = async () => {
    if (!window.google) {
      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyC1IXPN2zqdY6iCUxpwopAYH1m3VTKFqdE&libraries=places`
      script.async = true
      document.head.appendChild(script)

      await new Promise((resolve) => {
        script.onload = resolve
      })
    }

    if (!mapRef.current || !window.google) return

    const mapCenter = { lat: pickup.lat, lng: pickup.lng }

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
    })

    setMap(mapInstance)

    pickupMarkerRef.current = new window.google.maps.Marker({
      position: { lat: pickup.lat, lng: pickup.lng },
      map: mapInstance,
      icon: {
        url:
          "data:image/svg+xml;charset=UTF-8," +
          encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="14" fill="#ef4444" stroke="#ffffff" strokeWidth="3"/>
              <path d="M12 10h8l-2 4h2l-4 8-4-8h2l-2-4z" fill="#ffffff"/>
            </svg>
          `),
        scaledSize: new window.google.maps.Size(32, 32),
        anchor: new window.google.maps.Point(16, 16),
      },
      title: `Pickup Location - $${pickup.value}`,
    })

    const pickupInfoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 8px;">
          <h3 style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold;">Pickup Destination</h3>
          <p style="margin: 0; font-size: 12px; color: #666;">${pickup.address}</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: bold; color: #ef4444;">$${pickup.value}</p>
        </div>
      `,
    })

    pickupMarkerRef.current.addListener("click", () => {
      pickupInfoWindow.open(mapInstance, pickupMarkerRef.current)
    })
  }

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported")
      return
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    }

    const handleSuccess = async (position: GeolocationPosition) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
      setCurrentLocation(location)
      setLocationError(null)

      try {
        const address = await convertCoordinatesToAddress(location.lat, location.lng)
        setCurrentAddress(address)
      } catch (error) {
        console.error("Failed to convert location to address:", error)
        setCurrentAddress(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`)
      }
    }

    const handleError = (error: GeolocationPositionError) => {
      console.error("Geolocation error:", error)
      setLocationError("Unable to get your location")
    }

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options)

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options)
    watchIdRef.current = watchId
  }

  const updateDriverMarker = () => {
    if (!map || !currentLocation || !window.google) return

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null)
    }

    driverMarkerRef.current = new window.google.maps.Marker({
      position: currentLocation,
      map: map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#4285F4",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
      title: "Your Location",
      zIndex: 1000,
    })

    const driverInfoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 8px;">
          <h3 style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold;">Your Location</h3>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">
            ${currentAddress || "Getting address..."}
          </p>
          <p style="margin: 0; font-size: 10px; color: #999;">
            ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}
          </p>
        </div>
      `,
    })

    driverMarkerRef.current.addListener("click", () => {
      driverInfoWindow.open(map, driverMarkerRef.current)
    })

    if (pickupMarkerRef.current) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend(currentLocation)
      bounds.extend({ lat: pickup.lat, lng: pickup.lng })
      map.fitBounds(bounds, { padding: 50 })
    }
  }

  const startEtaPolling = () => {
    const pollEta = async () => {
      try {
        console.log(`Fetching ETA for pickup ${pickup.id}`)
        const response = await apiCall(`/api/sgrPickup/${pickup.id}/eta`, {
          method: "GET",
        })

        if (response.ok) {
          const etaText = await response.text()
          console.log("Raw ETA response:", etaText)

          try {
            const etaData: EtaResponse = JSON.parse(etaText)
            console.log("Parsed ETA data:", etaData)
            setEta(etaData)
          } catch (parseError) {
            console.log("ETA response is plain text:", etaText)
            setEta({
              estimatedTime: etaText || "Calculating...",
              distance: "Unknown",
            })
          }
        } else {
          console.error("Failed to fetch ETA:", response.status)
          setEta({
            estimatedTime: "Unable to calculate",
            distance: "Unknown",
          })
        }
      } catch (error) {
        console.error("Error fetching ETA:", error)
        setEta({
          estimatedTime: "Error calculating",
          distance: "Unknown",
        })
      } finally {
        setIsLoadingEta(false)
      }
    }

    pollEta()
    etaPollIntervalRef.current = setInterval(pollEta, 30000)
  }

  const startLocationUpdatePolling = (driverAddress: string) => {
    const updateDriverLocation = async () => {
      if (!currentLocation || !driverAddress) return

      try {
        const locationUpdateData = {
          driverLocation: driverAddress,
          pickupLocation: pickup.address,
          userId: userData.id,
          driverId: userData.id,
          cardId: Number.parseInt(cardId, 10),
        }

        console.log("Updating driver location with address:", locationUpdateData)

        const response = await apiCall(`/api/sgrPickup/${pickup.id}/dLocation`, {
          method: "PUT",
          body: JSON.stringify(locationUpdateData),
        })

        if (response.ok) {
          console.log("Driver location updated successfully")
        } else {
          console.error("Failed to update driver location:", response.status)
          const errorText = await response.text()
          console.error("Error details:", errorText)
        }
      } catch (error) {
        console.error("Error updating driver location:", error)
      }
    }

    if (locationUpdateIntervalRef.current) {
      clearInterval(locationUpdateIntervalRef.current)
    }

    updateDriverLocation()
    locationUpdateIntervalRef.current = setInterval(updateDriverLocation, 10000)
  }

  const handleCompletePickup = async () => {
    if (!currentLocation || !currentAddress) {
      setError("Unable to get your current location")
      return
    }

    setIsCompleting(true)
    setError(null)

    try {
      const completeData = {
        driverLocation: currentAddress,
        pickupLocation: pickup.address,
        userId: userData.id,
        driverId: userData.id,
        cardId: Number.parseInt(cardId, 10),
      }

      console.log("Completing pickup with address:", completeData)

      const response = await apiCall(`/api/sgrPickup/${pickup.id}/complete`, {
        method: "PUT",
        body: JSON.stringify(completeData),
      })

      if (response.ok) {
        console.log("Pickup completed successfully")
        onBack()
      } else {
        const errorText = await response.text()
        throw new Error(`Failed to complete pickup: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      console.error("Error completing pickup:", error)
      setError(error instanceof Error ? error.message : "Failed to complete pickup")
    } finally {
      setIsCompleting(false)
    }
  }

  const centerMapOnBothLocations = () => {
    if (!map || !currentLocation || !pickupMarkerRef.current) return

    const bounds = new window.google.maps.LatLngBounds()
    bounds.extend(currentLocation)
    bounds.extend({ lat: pickup.lat, lng: pickup.lng })
    map.fitBounds(bounds, { padding: 80 })
  }

  return (
    <div className="relative h-screen w-full bg-gray-100 overflow-hidden">
      <div className="absolute inset-0">
        <div ref={mapRef} className="w-full h-full" />
      </div>

      <div className="relative z-10 flex items-center justify-between p-4 bg-white/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-lg font-semibold text-gray-900">Pickup in Progress</h1>
        <Button variant="ghost" size="icon" onClick={centerMapOnBothLocations} className="rounded-full">
          <Navigation className="w-5 h-5" />
        </Button>
      </div>

      {locationError && (
        <div className="absolute top-20 left-4 right-4 z-10">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{locationError}</AlertDescription>
          </Alert>
        </div>
      )}

      {error && (
        <div className="absolute top-20 left-4 right-4 z-10">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="absolute top-24 left-4 right-4 z-10">
        <Card className="bg-white/95 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1">ETA</p>
                  {isLoadingEta ? (
                    <div className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-sm font-semibold text-gray-900">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-lg font-bold text-blue-600">{eta?.estimatedTime || "Calculating..."}</p>
                  )}
                </div>
              </div>

              {eta?.distance && eta.distance !== "Unknown" && (
                <>
                  <div className="w-px h-8 bg-gray-300"></div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-green-600" />
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">Distance</p>
                      <p className="text-lg font-bold text-green-600">{eta.distance}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200 p-4">
        <div className="max-w-md mx-auto space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1">Pickup #{pickup.id}</h3>
                  <p className="text-sm text-gray-600 break-words mb-2">{pickup.address}</p>
                  <p className="text-lg font-bold text-green-600">${pickup.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleCompletePickup}
            disabled={isCompleting || !currentLocation || !currentAddress}
            className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            {isCompleting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Completing Pickup...
              </>
            ) : (
              "Complete Pickup"
            )}
          </Button>

          {currentLocation && (
            <div className="text-center text-xs text-gray-500 space-y-1">
              <p className="font-medium">📍 Your current location:</p>
              <p className="break-words">{currentAddress || "Getting address..."}</p>
              <p className="text-gray-400">
                {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
