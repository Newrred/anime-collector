import { useEffect, useRef } from "react";

const stack = [];
let savedOverflow = "";
const focusable = (node) => [...node.querySelectorAll(
  'a[href], button, input, select, textarea, [tabindex]',
)].filter((element) => !element.disabled && element.tabIndex >= 0
  && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0);

// Only the topmost dialog owns Escape and focus, including nested sheets.
export function useModalInteraction({ open, onClose, busy = false }) {
  const ref = useRef(null);
  const options = useRef({ onClose, busy });
  options.current = { onClose, busy };
  useEffect(() => {
    if (!open || !ref.current) return undefined;
    const node = ref.current;
    const token = {};
    const returnFocus = document.activeElement;
    if (stack.length === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    stack.push(token);
    const layer = node.closest('[data-modal-layer]') || node;
    const previousZIndex = layer.style.zIndex;
    layer.style.zIndex = String(2000 + stack.length * 10);
    const isTop = () => stack.at(-1) === token;
    const focusFirst = () => (focusable(node)[0] || node).focus();
    const frame = requestAnimationFrame(() => { if (isTop()) focusFirst(); });
    const onKeyDown = (event) => {
      if (!isTop()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!options.current.busy) options.current.onClose?.();
      }
      if (event.key !== "Tab") return;
      const items = focusable(node);
      const first = items[0];
      const last = items.at(-1);
      if (!first || !node.contains(document.activeElement)
        || (event.shiftKey && document.activeElement === first)
        || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last || node : first || node).focus();
      }
    };
    const onFocus = (event) => {
      if (isTop() && !node.contains(event.target)) focusFirst();
    };
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocus);
      const wasTop = isTop();
      stack.splice(stack.indexOf(token), 1);
      layer.style.zIndex = previousZIndex;
      if (stack.length === 0) document.body.style.overflow = savedOverflow;
      if (wasTop && returnFocus?.isConnected) returnFocus.focus();
    };
  }, [open]);
  return ref;
}
