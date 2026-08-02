import "./Download.scss"

export const Download = () => {
  return (
    <>
      <div className="download-page">
        <a
          className="download-box"
          href="https://github.com/taren250424/nib/releases/download/v1.0.0/Nib.Setup.1.0.0.exe"
        >
          <img src={`${import.meta.env.BASE_URL}logo/windows.png`} alt="Windows" />
          <div className="text">
            <span className="platform">Windows 64-bit</span>
            <small className="version">v1.0.0</small>
          </div>
        </a>
        <div className="download-note">
          <span>Note</span>
          <ul>
            <li>Currently runs only on Windows 10/11 (64-bit).</li>
          </ul>
        </div>
      </div>
    </>
  )
}
