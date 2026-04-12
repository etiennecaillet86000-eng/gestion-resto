/**
 * Project-specific useActor wrapper.
 * Binds the generated backend createActor to the platform's useActor hook
 * so all hooks can call useActor() with no arguments.
 */
import { useActor as usePlatformActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";

export function useActor() {
  return usePlatformActor(createActor);
}
