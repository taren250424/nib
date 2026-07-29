/// <reference types="vitest" />
import { defineConfig } from "vite"

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
	},
	resolve: {
		alias: [
			{ find: "@main", replacement: "/src/main" },
			{ find: "@renderer", replacement: "/src/renderer" },
			{ find: "@shared", replacement: "/src/shared" },
			{ find: "@services", replacement: "/src/main/services" },
			{ find: "@modules_contracts", replacement: "/src/main/modules/contracts" },
		],
	},
})
