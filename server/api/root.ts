import { agentRouter } from "@/server/api/routers/agent";
import { calendarRouter } from "@/server/api/routers/calendar";
import { connectionsRouter } from "@/server/api/routers/connections";
import { gmailRouter } from "@/server/api/routers/gmail";
import { workspaceRouter } from "@/server/api/routers/workspace";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  agent: agentRouter,
  calendar: calendarRouter,
  connections: connectionsRouter,
  gmail: gmailRouter,
  workspace: workspaceRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
