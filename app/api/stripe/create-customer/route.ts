import { type NextRequest, NextResponse } from "next/server"

const STRIPE_SECRET_KEY =
  "sk_test_51RTPNgFawibChNbgnxmPjWiWOZJXvNDlG0LtWoGQbHsRwK8LHGL4A6O3AJ8NfkCqr06qiD2bjTEbFXxbVVGewwS1005HwHJ4RS"

export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, description } = await request.json()

    console.log("Creating Stripe customer:", { name, email, phone })

    const customerData = new URLSearchParams({
      name: name,
      email: email,
      phone: phone || "",
      description: description || "Customer created via driver app",
    })

    const response = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: customerData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Stripe customer creation failed:", errorText)
      return NextResponse.json({ error: `Failed to create customer: ${response.status}` }, { status: response.status })
    }

    const customer = await response.json()
    console.log("Stripe customer created:", customer.id)

    return NextResponse.json({
      customerId: customer.id,
      customer: customer,
    })
  } catch (error) {
    console.error("Error creating Stripe customer:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
