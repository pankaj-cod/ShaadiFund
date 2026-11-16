"use client";

import { restoreWeddingAction, suspendWeddingAction } from "../actions";
import { ReasonAction, SimpleAction } from "../reason-action";

export function WeddingActions({
  weddingId,
  suspended,
}: {
  weddingId: string;
  suspended: boolean;
}) {
  return suspended ? (
    <SimpleAction label="Restore" action={() => restoreWeddingAction(weddingId)} />
  ) : (
    <ReasonAction
      label="Suspend"
      confirmLabel="Suspend page"
      warning="Guests will no longer be able to see this page or contribute."
      action={(reason) => suspendWeddingAction(weddingId, reason)}
    />
  );
}
