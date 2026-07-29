import "./Header.scss"
import { Link } from "react-router-dom"

export const Header = () => {
  return (
    <>
      <header>
        <nav>
          <Link to="/">
            <img src={`${import.meta.env.BASE_URL}logo/velin.png`} />
          </Link>
          <Link to="/home">Home</Link>
          <Link to="/download">Download</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
    </>
  )
}
