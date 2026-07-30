/**
 * The settings dialog, with the ids SettingsElements looks for.
 *
 * `velin-select` is left undefined on purpose: the component's own rendering is
 * not what any of this is about, and an unknown element still carries a `value`
 * property and still delivers a `velin-select-changed` event — which is all the
 * renderer asks of it.
 */
export const SETTINGS_MARKUP = `
  <div id="settings-overlay">
    <button id="settings-exit"></button>
    <div id="settings-menus">
      <button id="settings-menu-editor"></button>
      <button id="settings-menu-theme"></button>
    </div>
    <div id="settings-contents">
      <div id="settings-contents-editor">
        <div id="setting-node-editor-width"><input type="number" /></div>
        <div id="setting-node-editor-size"><input type="number" /></div>
        <div id="setting-node-editor-family"><input type="text" /></div>
        <div id="setting-node-editor-auto-save"><velin-select></velin-select></div>
      </div>
      <div id="settings-contents-theme">
        <div id="settings-node-theme"><velin-select></velin-select></div>
      </div>
    </div>
    <button id="settings-close-btn"></button>
    <button id="settings-apply-btn"></button>
  </div>
`
