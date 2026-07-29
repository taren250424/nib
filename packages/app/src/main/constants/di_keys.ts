const DI_KEYS = {
  FileManager: Symbol("FileManager"),
  FileWatcher: Symbol("FileWatcher"),

  dialogManager: Symbol("dialogManager"),

  WindowRepository: Symbol("WindowRepository"),
  SettingsRepository: Symbol("SettingsRepository"),
  SideRepository: Symbol("SideRepository"),
  TabRepository: Symbol("TabRepository"),
  TreeRepository: Symbol("TreeRepository"),

  WindowUtils: Symbol("WindowUtils"),
  SettingsUtils: Symbol("SettingsUtils"),
  TabUtils: Symbol("TabUtils"),
  TreeUtils: Symbol("TreeUtils"),

  FileService: Symbol("FileService"),
  TabService: Symbol("TabService"),
  TreeService: Symbol("TreeService"),
  SideService: Symbol("SideService"),
  SettingsService: Symbol("SettingsService"),
}

export default DI_KEYS
