"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { X, CreditCard, Loader2, AlertCircle } from "lucide-react"
import { apiCall } from "@/lib/api-config"

interface CardData {
  cardNumber: string
  cardholderName: string
  accountId: string
  userId: number
  cardId: number
}

interface CardSelectionPopupProps {
  userId: number
  onCardSelected: (cardId: string) => void
  onClose: () => void
}

export default function CardSelectionPopup({ userId, onCardSelected, onClose }: CardSelectionPopupProps) {
  const [cards, setCards] = useState<CardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUserCards()
  }, [userId])

  const fetchUserCards = async () => {
    setLoading(true)
    setError(null)

    try {
      console.log(`Fetching cards for user ID: ${userId}`)
      const response = await apiCall(`/api/cards/all/${userId}`, {
        method: "GET",
      })

      if (response.ok) {
        const cardsData = await response.json()
        console.log("Fetched cards:", cardsData)

        // Sort cards by cardId in ascending order
        const sortedCards = cardsData.sort((a: CardData, b: CardData) => a.cardId - b.cardId)
        setCards(sortedCards)
      } else {
        const errorText = await response.text()
        console.error("Failed to fetch cards:", response.status, errorText)
        setError(`Failed to load cards: ${response.status}`)
      }
    } catch (error) {
      console.error("Error fetching cards:", error)
      setError("Unable to load cards. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  const handleCardSelect = (card: CardData) => {
    console.log("=== CARD SELECTION DEBUG ===")
    console.log("Selected card object:", card)
    console.log("Card ID:", card.cardId)
    console.log("Card ID type:", typeof card.cardId)
    console.log("Card Number:", card.cardNumber)
    console.log("Card holder name:", card.cardholderName)
    console.log("Account ID:", card.accountId)
    console.log("User ID:", card.userId)
    console.log("=== END CARD DEBUG ===")

    // Use the cardId field from the API response
    const cardIdToUse = card.cardId?.toString() || ""
    console.log("Card ID to use for pickup:", cardIdToUse)

    onCardSelected(cardIdToUse)
  }

  const maskCardNumber = (cardNumber: string) => {
    if (!cardNumber || cardNumber.length <= 8) return cardNumber || "****"
    return `****${cardNumber.slice(-4)}`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Select Payment Card</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading your cards...</span>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && cards.length === 0 && (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-4">No payment cards found</p>
              <p className="text-xs text-gray-400">Please add a debit card first to start pickups</p>
            </div>
          )}

          {!loading && !error && cards.length > 0 && (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              <p className="text-sm text-gray-600 mb-3">Choose a payment card for this pickup:</p>

              {cards.map((card) => (
                <Card
                  key={card.cardId}
                  className="cursor-pointer hover:bg-gray-50 transition-colors border-2 hover:border-blue-200"
                  onClick={() => handleCardSelect(card)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <CreditCard className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-900">{card.cardholderName}</p>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            ID: {card.cardId || "N/A"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-1">Card: {maskCardNumber(card.cardNumber)}</p>
                        <p className="text-xs text-gray-500">Account: {card.accountId?.slice(0, 20) || "N/A"}...</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          <Button variant="outline" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
