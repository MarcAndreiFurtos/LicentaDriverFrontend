@RestController
@RequestMapping("/api/stripe")
@CrossOrigin(origins = "*")
public class StripeController {

    @Value("${stripe.secret.key:sk_test_51RTPNgFawibChNbgnxmPjWiWOZJXvNDlG0LtWoGQbHsRwK8LHGL4A6O3AJ8NfkCqr06qiD2bjTEbFXxbVVGewwS1005HwHJ4RS}")
    private String stripeSecretKey;

    @PostMapping("/customers")
    public ResponseEntity<?> createStripeCustomer(@RequestBody CustomerCreateRequest request) {
        try {
            // Set the Stripe API key
            Stripe.apiKey = stripeSecretKey;

            // Create customer parameters
            CustomerCreateParams params = CustomerCreateParams.builder()
                .setEmail(request.getEmail())
                .setName(request.getName())
                .setPhone(request.getPhone())
                .setDescription(request.getDescription())
                .build();

            // Create the customer
            Customer customer = Customer.create(params);

            // Return the customer ID
            Map<String, String> response = new HashMap<>();
            response.put("id", customer.getId());
            response.put("customerId", customer.getId());

            return ResponseEntity.ok(response);

        } catch (StripeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to create customer: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Unexpected error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/payment-methods/attach")
    public ResponseEntity<?> attachPaymentMethod(@RequestBody AttachPaymentMethodRequest request) {
        try {
            // Set the Stripe API key
            Stripe.apiKey = stripeSecretKey;

            // Get the payment method
            PaymentMethod paymentMethod = PaymentMethod.retrieve(request.getPaymentMethodId());

            // Attach to customer
            PaymentMethodAttachParams params = PaymentMethodAttachParams.builder()
                .setCustomer(request.getCustomerId())
                .build();

            paymentMethod.attach(params);

            // Return success
            Map<String, String> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "Payment method attached successfully");

            return ResponseEntity.ok(response);

        } catch (StripeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to attach payment method: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Unexpected error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    // DTO Classes
    public static class CustomerCreateRequest {
        private String email;
        private String name;
        private String phone;
        private String description;

        // Getters and setters
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        
        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }
        
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    public static class AttachPaymentMethodRequest {
        private String paymentMethodId;
        private String customerId;

        // Getters and setters
        public String getPaymentMethodId() { return paymentMethodId; }
        public void setPaymentMethodId(String paymentMethodId) { this.paymentMethodId = paymentMethodId; }
        
        public String getCustomerId() { return customerId; }
        public void setCustomerId(String customerId) { this.customerId = customerId; }
    }
}
