import "./Download.scss"

export const Download = () => {
  return (
    <>
      <div className="download-page">
        <a
          className="download-box"
          href="https://github.com/taren250424/velin/releases/download/v0.1.0/Velin.Setup.0.1.0.exe"
        >
          <img src={`${import.meta.env.BASE_URL}logo/windows.png`} alt="Windows" />
          <div className="text">
            <span className="platform">Windows 64-bit</span>
            <small className="version">v0.1.0 (Beta)</small>
          </div>
        </a>
        <div className="download-note">
          <span>Note</span>
          <ul>
            <li>This program is currently in beta testing.</li>
            <li>Currently runs only on Windows 10/11 (64-bit).</li>
          </ul>
        </div>
      </div>
    </>
  )
}
