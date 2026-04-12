import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";
import { useInternetIdentity } from "./useInternetIdentity";

const ACTOR_QUERY_KEY = "actor";
export function useActor() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY, identity?.getPrincipal().toString()],
    queryFn: async () => {
      const isAuthenticated = !!identity;
      console.log(
        "[useActor] queryFn called, isAuthenticated:",
        isAuthenticated,
      );
      try {
        if (!isAuthenticated) {
          console.log("[useActor] Creating anonymous actor...");
          const actor = await createActorWithConfig();
          console.log("[useActor] Anonymous actor created:", !!actor);
          return actor;
        }
        const actorOptions = { agentOptions: { identity } };
        console.log("[useActor] Creating authenticated actor...");
        const actor = await createActorWithConfig(actorOptions);
        console.log("[useActor] Authenticated actor created:", !!actor);
        return actor;
      } catch (e) {
        console.error("[useActor] FAILED to create actor:", e);
        throw e;
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: true,
  });

  useEffect(() => {
    if (actorQuery.data) {
      console.log("[useActor] Actor ready, invalidating dependent queries");
      queryClient.invalidateQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
      queryClient.refetchQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
    }
  }, [actorQuery.data, queryClient]);

  if (actorQuery.isError) {
    console.error("[useActor] Actor query error:", actorQuery.error);
  }

  return {
    actor: actorQuery.data || null,
    isFetching: actorQuery.isFetching,
  };
}
