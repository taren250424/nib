import { Route, HashRouter as Router, Routes } from "react-router-dom"
import routes from "./routes"
import "./App.scss"

const App = () => {
  return (
    <div id="app-container">
      <Router>
        <Routes>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </Router>
    </div>
  )
}

export default App
