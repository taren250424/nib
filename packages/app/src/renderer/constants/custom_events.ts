export const CUSTOM_EVENTS = {
  CLICK: {
    DEFAULT: Symbol("click-default"),
  },

  CONTEXTMENU: {
    DEFAULT: Symbol("contextmenu-default"),
  },

  MOUSE_DOWN: {
    DEFAULT: Symbol("mousedown-default"),

    OUT: {
      TAB_CONTEXTMENU: Symbol("mousedown-out-tabContextmenu"),
      TREE_CONTEXTMENU: Symbol("mousedown-out-treeContextmenu"),
      MENU_ITEM: Symbol("mousedown-out-menuItem"),
      WINDOW: Symbol("mousedown-out-window"),
      SIDE: Symbol("mousedown-out-side"),
      TAB_CONTAINER: Symbol("mousedown-out-tabContainer"),
      EDITOR_CONTAINER: Symbol("mousedown-out-editorContainer"),
      FIND_REPLACE_CONTAINER: Symbol("mousedown-out-findReplaceContainer"),
    },
  },

  MOUSE_MOVE: {
    DEFAULT: Symbol("mousemove-default"),
  },

  MOUSE_UP: {
    DEFAULT: Symbol("mouseup-default"),
  },

  MOUSE_LEAVE: {
    DEFAULT: Symbol("mouseleave-default"),
  },
}
