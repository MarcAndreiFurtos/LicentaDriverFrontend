"use client"

import { useEffect, useRef, useState } from "react"

interface PickupLocation {
  id: string
  lat: number
  lng: number
  address: string
  value: number
}

interface GoogleMapProps {
  center?: { lat: number; lng: number }
  zoom: number
  pickupLocations: PickupLocation[]
  onLocationUpdate?: (location: { lat: number; lng: number }) => void
  onStartPickup?: (pickup: PickupLocation) => void
}

declare global {
  interface Window {
    google: any
    initMap?: () => void
  }
}

export default function GoogleMap({ center, zoom, pickupLocations, onLocationUpdate, onStartPickup }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)
  const [mapInitialized, setMapInitialized] = useState(false)
  const currentLocationMarkerRef = useRef<any>(null)
  const accuracyCircleRef = useRef<any>(null)
  const lastUpdateTimeRef = useRef<number>(0)
  const pickupMarkersRef = useRef<any[]>([])

  // Get user's current location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser")
      return
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000, // Reduced from 60000 to 30000 for more frequent updates
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }

      console.log("Current location:", location)

      // Throttle location updates to prevent lag
      const now = Date.now()
      if (now - lastUpdateTimeRef.current < 2000) {
        // Only update every 2 seconds
        return
      }
      lastUpdateTimeRef.current = now

      setCurrentLocation(location)
      setLocationError(null)

      // Notify parent component of location update
      onLocationUpdate?.(location)

      // Initialize map with user location if not already initialized
      if (!mapInitialized && !map) {
        // Map will be initialized with this location
        return
      }

      // Update marker without affecting map center
      if (map && window.google) {
        updateCurrentLocationMarker(location)
      }
    }

    const handleError = (error: GeolocationPositionError) => {
      console.error("Geolocation error:", error)
      let errorMessage = "Unable to get your location"

      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = "Location access denied by user"
          break
        case error.POSITION_UNAVAILABLE:
          errorMessage = "Location information unavailable"
          break
        case error.TIMEOUT:
          errorMessage = "Location request timed out"
          break
      }

      setLocationError(errorMessage)

      // Initialize map with default location if geolocation fails
      if (!mapInitialized) {
        setMapInitialized(true)
      }
    }

    // Get initial location
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options)

    // Watch for location changes with reduced frequency
    const id = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      ...options,
      maximumAge: 10000, // Cache for 10 seconds to reduce updates
    })
    setWatchId(id)

    return () => {
      if (id) {
        navigator.geolocation.clearWatch(id)
      }
    }
  }, [map, onLocationUpdate, mapInitialized])

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      initializeMap()
      return
    }

    // Load Google Maps API
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyC1IXPN2zqdY6iCUxpwopAYH1m3VTKFqdE&libraries=places&callback=initMap`
    script.async = true
    script.defer = true

    // Define the callback function globally
    window.initMap = () => {
      setIsLoaded(true)
      initializeMap()
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
      // Clean up global callback
      delete window.initMap
      // Clear location watch
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [])

  // Initialize map when we have location or after timeout
  useEffect(() => {
    if (isLoaded && !map && (currentLocation || mapInitialized)) {
      initializeMap()
    }
  }, [isLoaded, currentLocation, mapInitialized, map])

  // Update pickup markers when pickupLocations change
  useEffect(() => {
    if (map && window.google) {
      updatePickupMarkers()
    }
  }, [pickupLocations, map, onStartPickup])

  const updateCurrentLocationMarker = (location: { lat: number; lng: number }) => {
    if (!map || !window.google) return

    // Use requestAnimationFrame to smooth updates and prevent lag
    requestAnimationFrame(() => {
      // Remove existing marker and circle
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.setMap(null)
      }
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setMap(null)
      }

      // Create new current location marker with optimized settings
      currentLocationMarkerRef.current = new window.google.maps.Marker({
        position: location,
        map: map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        title: "Your Current Location",
        zIndex: 1000,
        optimized: true, // Enable marker optimization
      })

      // Create accuracy circle with reduced visual impact
      accuracyCircleRef.current = new window.google.maps.Circle({
        strokeColor: "#4285F4",
        strokeOpacity: 0.4,
        strokeWeight: 1,
        fillColor: "#4285F4",
        fillOpacity: 0.03,
        map: map,
        center: location,
        radius: 25,
        clickable: false, // Make circle non-interactive to improve performance
      })
    })
  }

  const updatePickupMarkers = () => {
    if (!map || !window.google) return

    console.log("Updating pickup markers. Count:", pickupLocations.length)

    // Clear existing pickup markers
    pickupMarkersRef.current.forEach((marker) => {
      marker.setMap(null)
    })
    pickupMarkersRef.current = []

    // Add new pickup location markers
    pickupLocations.forEach((location) => {
      console.log("Adding marker for pickup:", location.id, "at", location.lat, location.lng)

      const marker = new window.google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: map,
        icon: {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="14" fill="#10b981" stroke="#ffffff" strokeWidth="3"/>
              <path d="M12 10h8l-2 4h2l-4 8-4-8h2l-2-4z" fill="#ffffff"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 16),
        },
        title: `Pickup ID: ${location.id} - Value: $${location.value}`,
        optimized: true, // Enable marker optimization
      })

      // Add info window with Start Pickup button
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
    <div style="padding: 8px; min-width: 200px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">Pickup #${location.id}</h3>
      <p style="margin: 0 0 4px 0; font-size: 14px; color: #666;">${location.address}</p>
      <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: bold; color: #10b981;">Value: $${location.value}</p>
      <button 
        id="start-pickup-${location.id}" 
        style="
          background: #10b981; 
          color: white; 
          border: none; 
          padding: 8px 16px; 
          border-radius: 6px; 
          font-size: 14px; 
          font-weight: 600; 
          cursor: pointer;
          width: 100%;
        "
        onmouseover="this.style.background='#059669'" 
        onmouseout="this.style.background='#10b981'"
      >
        Start Pickup
      </button>
    </div>
  `,
      })

      marker.addListener("click", () => {
        infoWindow.open(map, marker)

        // Add click listener for the Start Pickup button after the info window opens
        setTimeout(() => {
          const startButton = document.getElementById(`start-pickup-${location.id}`)
          if (startButton && onStartPickup) {
            startButton.onclick = () => {
              onStartPickup(location)
              infoWindow.close()
            }
          }
        }, 100)
      })

      // Store marker reference for cleanup
      pickupMarkersRef.current.push(marker)
    })

    console.log("Added", pickupMarkersRef.current.length, "pickup markers to map")
  }

  const initializeMap = () => {
    if (!mapRef.current || !window.google || map) return

    // Use current location if available, otherwise use provided center or default to Timisoara, Romania
    const mapCenter = currentLocation || center || { lat: 45.7489, lng: 21.2087 } // Timisoara coordinates

    console.log("Initializing map with center:", mapCenter)

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
      ],
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      scaleControl: false,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false,
      gestureHandling: "greedy", // Improve touch/scroll performance
    })

    setMap(mapInstance)
    setMapInitialized(true)

    // Add current location marker if we have the location
    if (currentLocation) {
      updateCurrentLocationMarker(currentLocation)
    }

    console.log("Map initialized successfully")
  }

  // Function to center map on current location
  const centerOnCurrentLocation = () => {
    if (currentLocation && map) {
      map.panTo(currentLocation) // Use panTo instead of setCenter for smoother animation
      map.setZoom(16)
    } else {
      // Try to get location again
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }
            setCurrentLocation(location)
            if (map) {
              map.panTo(location)
              map.setZoom(16)
              updateCurrentLocationMarker(location)
            }
          },
          (error) => {
            console.error("Error getting current location:", error)
          },
        )
      }
    }
  }

  // Expose center function to parent
  useEffect(() => {
    if (window) {
      ;(window as any).centerOnCurrentLocation = centerOnCurrentLocation
    }
  }, [currentLocation, map])

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: "100%" }} />

      {/* Location status indicator */}
      {locationError && (
        <div className="absolute top-4 left-4 bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-md text-sm max-w-xs">
          <p className="font-medium">Location Error</p>
          <p className="text-xs">{locationError}</p>
        </div>
      )}

      {currentLocation && (
        <div className="absolute top-4 left-4 bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded-md text-sm">
          <p className="font-medium">📍 Location Active</p>
          <p className="text-xs">
            {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
          </p>
        </div>
      )}
    </div>
  )
}
