import { z } from "zod";

/**
 * An email address typed by a person. Spaces and capitals are removed before
 * the format check, so "  Meera@Example.com " (common after phone autocomplete)
 * is accepted as meera@example.com.
 */
export function emailField(message = "Please enter a valid email address") {
  return z.string().trim().toLowerCase().max(254, message).pipe(z.email(message));
}
