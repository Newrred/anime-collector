import { useEffect, useState } from "react";
import { readJson, writeJson } from "../storage/localJsonStore";

export function useStoredState(key, initialValue) {
  const [state, setState] = useState(() => readJson(key, initialValue));

  useEffect(() => {
    writeJson(key, state);
  }, [key, state]);

  return [state, setState];
}

