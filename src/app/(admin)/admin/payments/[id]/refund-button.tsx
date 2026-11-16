"use client";

import { refundPaymentAction } from "../../actions";
import { ReasonAction } from "../../reason-action";

export function RefundButton({ paymentId, amount }: { paymentId: string; amount: string }) {
  return (
    <ReasonAction
      label="Refund in full"
      confirmLabel={`Refund ${amount}`}
      warning={`This returns ${amount} to the guest and removes the gift from the couple's dream. It cannot be undone.`}
      action={(reason) => refundPaymentAction(paymentId, reason)}
    />
  );
}
