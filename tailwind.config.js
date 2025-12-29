/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                cyber: {
                    dark: '#050510',
                    light: '#0a0a1f',
                    neon: '#00f3ff',
                    alert: '#ff003c',
                    success: '#00ff9f',
                    dim: 'rgba(0, 243, 255, 0.1)',
                }
            },
            fontFamily: {
                hud: ['"Courier New"', 'Courier', 'monospace'],
            }
        },
    },
    plugins: [],
}
