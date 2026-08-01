import { DOM } from "@renderer/constants"

export const UI_ZONES = {
  // NOTE: More specific zones must come before broader ones,
  // since we use Array.find() which returns the first match.
  // e.g. FIND_REPLACE_CONTAINER must precede EDITOR_CONTAINER
  // because the find/replace UI is nested inside the editor container.
  FIND_REPLACE_CONTAINER: {
    id: "find-replace-container",
    dom: DOM.SELECTOR_FIND_REPLACE_CONTAINER,
    task: "find-replace",
  },
  EDITOR_CONTAINER: {
    id: "editor-container",
    dom: DOM.SELECTOR_EDITOR_CONTAINER,
    task: "editor",
  },
  SIDE: {
    id: "side",
    dom: DOM.SELECTOR_SIDE,
    task: "tree",
  },
  TAB_CONTAINER: {
    id: "tab-container",
    dom: DOM.SELECTOR_TAB_CONTAINER,
    task: "tab",
  },
  TREE_CONTEXT_MENU: {
    id: "tree-context-menu",
    dom: DOM.SELECTOR_TREE_CONTEXT_MENU,
    task: "tree",
  },
  TAB_CONTEXT_MENU: {
    id: "tab-context-menu",
    dom: DOM.SELECTOR_TAB_CONTEXT_MENU,
    task: "tab",
  },
  MENU_ITEM: {
    id: "menu-item",
    dom: DOM.SELECTOR_MENU_ITEM,
    task: "",
  },
  WINDOW: {
    id: "window",
    dom: DOM.SELECTOR_WINDOW,
    task: "",
  },
} as const

export const UI_ZONES_VALUES = Object.values(UI_ZONES)

export type ZoneId = (typeof UI_ZONES)[keyof typeof UI_ZONES]["id"]
// "" is excluded: it marks a zone that has no task of its own (MENU_ITEM,
// WINDOW) and is only ever a sentinel to skip, never a value to hold — with it
// in the union, setFocusedTask("") compiled and the runtime guards that skip
// it were unchecked convention. "none" is the one real empty value.
export type Task = Exclude<(typeof UI_ZONES)[keyof typeof UI_ZONES]["task"], ""> | "none"
