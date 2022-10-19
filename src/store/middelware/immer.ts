import { produce } from "immer";
import type { Draft } from "immer";
import { GetState, SetState, State, StateCreator, StoreApi } from "zustand";

/**
 * The immer middleware turns the `set` method into a proxy for the immer `produce` method.
 * https://immerjs.github.io/immer/
 *
 * The TypeScript magic is taken from here:
 * https://github.com/pmndrs/zustand/blob/main/tests/middlewareTypes.test.tsx
 */
export const immer =
  <
    T extends State,
    CustomSetState extends SetState<T>,
    CustomGetState extends GetState<T>,
    CustomStoreApi extends StoreApi<T>
  >(
    config: StateCreator<
      T,
      (partial: ((draft: Draft<T>) => void) | T, replace?: boolean) => void,
      CustomGetState,
      CustomStoreApi
    >
  ): StateCreator<T, CustomSetState, CustomGetState, CustomStoreApi> =>
  (set, get, api) => {
    // see https://github.com/pmndrs/zustand/issues/449#issuecomment-873777576
    api.setState = (fn) => set(produce(fn as (state: Draft<T>) => T));

    return config(
      (partial, replace) => {
        const nextState =
          typeof partial === "function"
            ? produce(partial as (state: Draft<T>) => T)
            : (partial as T);
        return set(nextState, replace);
      },
      get,
      api
    );
  };
