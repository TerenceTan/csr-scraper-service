import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { authenticateRequest } from "../auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: {
    id: number;
    username: string;
    name: string | null;
    email: string | null;
    role: "user" | "admin";
  } | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user = null;

  try {
    user = await authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
