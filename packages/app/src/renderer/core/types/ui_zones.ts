import { CUSTOM_EVENTS, DOM } from "@renderer/constants"

export const UI_ZONES = {
  // NOTE: More specific zones must come before broader ones,
  // since we use Array.find() which returns the first match.
  // e.g. FIND_REPLACE_CONTAINER must precede EDITOR_CONTAINER
  // because the find/replace UI is nested inside the editor container.
  FIND_REPLACE_CONTAINER: {
    id: "find-replace-container",
    dom: DOM.SELECTOR_FIND_REPLACE_CONTAINER,
    outEvent: CUSTOM_EVENTS.MOUSE_DOWN.OUT.FIND_REPLACE_CONTAINER,
    task: "find-replace",
  },
  EDITOR_CONTAINER: {
    id: "editor-container",
    dom: DOM.SELECTOR_EDITOR_CONTAINER,
    outEvent: CUSTOM_EVENTS.MOUSE_DOWN.OUT.EDITOR_CONTAINER,
    task: "editor",
  },
  SIDE: {
    id: "side",
    dom: DOM.SELECTOR_SIDE,
    outEvent: CUSTOM_EVENTS.MOUSE_DOWN.OUT.SIDE,
    task: "tree",
  },
  TAB_CONTAINER: {
    id: "tab-container",
    dom: DOM.SELECTOR_TAB_CONTAINER,
    outEvent: CUSTOM_EVENTS.MOUSE_DOWN.OUT.TAB_CONTAINER,
    task: "tab",
  },
  TREE_CONTEXT_MENU: {
    id: "tree-context-menu",
    dom: DOM.SELECTOR_TREE_CONTEXT_MENU,
    outEvent: CUSTOM_EVENTS.MOUSE_DOWN.OUT.TREE_CONTEXTMENU,
    task: "tree",
  },
  TAB_CONTEXT_MENU: {
    id: "tab-context-menu",
    dom: DOM.SELECTOR_TAB_CONTEXT_MENU,
    outEvent: CUSTOM_EVENTS.MOUSE_DOWN.OUT.TAB_CONTEXTMENU,
    task: "tab",
  },
  MENU_ITEM: {
    id: "menu-item",
    dom: DOM.SELECTOR_MENU_ITEM,
    outEvent: CUSTOM_EVENTS.MOUSE_DOWN.OUT.MENU_ITEM,
    task: "",
  },
  WINDOW: {
    id: "window",
    dom: DOM.SELECTOR_WINDOW,
    outEvent: CUSTOM_EVENTS.MOUSE_DOWN.OUT.WINDOW,
    task: "",
  },
} as const

export const UI_ZONES_VALUES = Object.values(UI_ZONES)

export type Zone = (typeof UI_ZONES)[keyof typeof UI_ZONES]["id"] | "none"
export type Task = (typeof UI_ZONES)[keyof typeof UI_ZONES]["task"] | "none"
