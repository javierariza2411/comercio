import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          50: '#f8f4eb',
          100: '#efe3c7',
          500: '#b88a3a',
          700: '#8a6327',
        },
      },
    },
  },
  plugins: [],
};

export default config;
