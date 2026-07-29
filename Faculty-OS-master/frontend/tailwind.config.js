/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        paper: "var(--paper)",
        surface: "var(--surface)",
        border: "var(--border)",
        
        // Agent 1
        "agent1-500": "var(--agent1-500)",
        "agent1-100": "var(--agent1-100)",
        "agent1-700": "var(--agent1-700)",
        
        // Agent 2
        "agent2-500": "var(--agent2-500)",
        "agent2-100": "var(--agent2-100)",
        "agent2-700": "var(--agent2-700)",
        
        // Agent 3
        "agent3-500": "var(--agent3-500)",
        "agent3-100": "var(--agent3-100)",
        "agent3-700": "var(--agent3-700)",

        // Agent 4
        "agent4-500": "var(--agent4-500)",
        "agent4-100": "var(--agent4-100)",
        "agent4-700": "var(--agent4-700)",

        // Agent 5
        "agent5-500": "var(--agent5-500)",
        "agent5-100": "var(--agent5-100)",
        "agent5-700": "var(--agent5-700)",

        // Agent 6
        "agent6-500": "var(--agent6-500)",
        "agent6-100": "var(--agent6-100)",
        "agent6-700": "var(--agent6-700)",
        
        // Status
        "status-good": "var(--status-good)",
        "status-warn": "var(--status-warn)",
        "status-bad": "var(--status-bad)",
        "accent-500": "var(--accent-500)",
        "accent-100": "var(--accent-100)",
        "accent-700": "var(--accent-700)",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        ui: ["Inter", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        "radius-sm": "8px",
        "radius-md": "12px",
        "radius-lg": "20px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20,24,31,0.04), 0 4px 16px rgba(20,24,31,0.06)",
      }
    },
  },
  plugins: [],
}
