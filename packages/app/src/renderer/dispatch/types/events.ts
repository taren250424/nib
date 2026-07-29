export type AppEvents =
	| "undo"
	| "redo"
	//
	| "newTab"
	| "openFile"
	| "openDirectoryByDialog"
	| "openDirectoryByTreeNode"
	| "save"
	| "saveAs"
	| "saveAll"
	//
	| "closeTab"
	| "closeOtherTabs"
	| "closeTabsToRight"
	| "closeAllTabs"
	//
	| "create"
	| "rename"
	| "delete"
	//
	| "cut"
	| "copy"
	| "paste"
	//
	| "toggleFindReplace"
	| "searchQueryChanged"
	| "replaceQueryChanged"
	| "toggleSearchOption"
	| "find"
	| "replace"
	| "replaceAll"
	| "closeFindReplace"
	//
	| "applySettings"
	| "applyAndSaveSettings"
