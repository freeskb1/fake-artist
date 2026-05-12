import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#FAF6F0",
        ink: "#1a1a1a",
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
