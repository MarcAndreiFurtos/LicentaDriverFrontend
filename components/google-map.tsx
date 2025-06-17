"use client"

import { useEffect, useRef, useState } from "react"

interface PickupLocation {
  id: string
  lat: number
  lng: number
  address: string
  customerName: string
  items: string[]
  earnings: number
}

interface GoogleMapProps {
  center: { lat: number; lng: number }
  zoom: number
  pickupLocations: PickupLocation[]
}

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export default function GoogleMap({ center, zoom, pickupLocations }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)

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
    }
  }, [])

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center,
      zoom,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
      ],
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: false,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false,
    })

    setMap(mapInstance)

    // Add current location marker
    new window.google.maps.Marker({
      position: center,
      map: mapInstance,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#4285F4",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
      title: "Your Location",
    })

    // Add pickup location markers
    pickupLocations.forEach((location) => {
      const marker = new window.google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: mapInstance,
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
        title: `${location.customerName} - $${location.earnings}`,
      })

      // Add info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">${location.customerName}</h3>
            <p style="margin: 0 0 4px 0; font-size: 14px; color: #666;">${location.address}</p>
            <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Items:</strong> ${location.items.join(", ")}</p>
            <p style="margin: 0; font-size: 16px; font-weight: bold; color: #10b981;">$${location.earnings}</p>
          </div>
        `,
      })

      marker.addListener("click", () => {
        infoWindow.open(mapInstance, marker)
      })
    })
  }

  return <div ref={mapRef} className="w-full h-full" style={{ minHeight: "100%" }} />
}
