import { type NextRequest, NextResponse } from "next/server"

const STRIPE_SECRET_KEY =
  "sk_test_51RTPNgFawibChNbgnxmPjWiWOZJXvNDlG0LtWoGQbHsRwK8LHGL4A6O3AJ8NfkCqr06qiD2bjTEbFXxbVVGewwS1005HwHJ4RS"

export async function POST(request: NextRequest) {
  try {
    const { token, customerId } = await request.json()

    console.log("Creating payment method with token:", token)

    // Create payment method from token
    const paymentMethodData = new URLSearchParams({
      type: "card",
      "card[token]": token,
    })

    const paymentMethodResponse = await fetch("https://api.stripe.com/v1/payment_methods", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: paymentMethodData,
    })

    if (!paymentMethodResponse.ok) {
      const errorText = await paymentMethodResponse.text()
      console.error("Payment method creation failed:", errorText)
      return NextResponse.json(
        { error: `Failed to create payment method: ${paymentMethodResponse.status}` },
        { status: paymentMethodResponse.status },
      )
    }

    const paymentMethod = await paymentMethodResponse.json()
    console.log("Payment method created:", paymentMethod.id)

    // Attach payment method to customer
    if (customerId) {
      const attachData = new URLSearchParams({
        customer: customerId,
      })

      const attachResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${paymentMethod.id}/attach`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: attachData,
      })

      if (!attachResponse.ok) {
        console.error("Failed to attach payment method to customer")
      } else {
        console.log("Payment method attached to customer")
      }
    }

    return NextResponse.json({
      paymentMethodId: paymentMethod.id,
      paymentMethod: paymentMethod,
    })
  } catch (error) {
    console.error("Error creating payment method:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
