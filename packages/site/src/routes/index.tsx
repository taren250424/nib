import type { RouteConfig } from "./RouteConfig"

import { DefaultLayout } from "../layouts"

import { Home } from "../pages/home"
import { Download } from "../pages/download"
import { About } from "../pages/about"

const routes: RouteConfig[] = [
  {
    path: "/",
    element: (
      <DefaultLayout>
        <Home />
      </DefaultLayout>
    ),
  },
  {
    path: "/home",
    element: (
      <DefaultLayout>
        <Home />
      </DefaultLayout>
    ),
  },
  {
    path: "/download",
    element: (
      <DefaultLayout>
        <Download />
      </DefaultLayout>
    ),
  },
  {
    path: "/about",
    element: (
      <DefaultLayout>
        <About />
      </DefaultLayout>
    ),
  },
]

export default routes
