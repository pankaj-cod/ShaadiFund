import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/modules/auth/auth";

const handler = () => toNextJsHandler(getAuth());

export function GET(request: Request): Promise<Response> {
  return handler().GET(request);
}

export function POST(request: Request): Promise<Response> {
  return handler().POST(request);
}
