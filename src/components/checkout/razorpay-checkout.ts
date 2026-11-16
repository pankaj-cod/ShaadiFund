/**
 * Opens Razorpay's hosted checkout. Card, UPI and bank details are entered in
 * Razorpay's own window and never touch our page or server.
 */
const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  prefill: { name: string; email: string };
  theme: { color: string };
  retry: { enabled: boolean };
  handler: (response: RazorpaySuccess) => void;
  modal: { ondismiss: () => void; confirm_close: boolean };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", handler: () => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Could not load the payment window"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type RazorpayResult =
  | { outcome: "paid"; response: RazorpaySuccess }
  /** The guest closed the window. `attempted` is true if a payment was tried and failed first. */
  | { outcome: "closed"; attempted: boolean };

export async function openRazorpayCheckout(input: {
  key: string;
  orderId: string;
  amountPaise: number;
  description: string;
  guestName: string;
  guestEmail: string;
}): Promise<RazorpayResult> {
  await loadScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Could not load the payment window");

  return new Promise<RazorpayResult>((resolve) => {
    let attempted = false;
    const checkout = new Razorpay({
      key: input.key,
      order_id: input.orderId,
      amount: input.amountPaise,
      currency: "INR",
      name: "VowFund",
      description: input.description,
      prefill: { name: input.guestName, email: input.guestEmail },
      theme: { color: "#2b2926" },
      retry: { enabled: true },
      handler: (response) => resolve({ outcome: "paid", response }),
      modal: { ondismiss: () => resolve({ outcome: "closed", attempted }), confirm_close: true },
    });
    checkout.on("payment.failed", () => {
      attempted = true;
    });
    checkout.open();
  });
}
