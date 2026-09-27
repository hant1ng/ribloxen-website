import { defineConfig } from 'astro/config';
export default defineConfig({site:'https://ribloxen.com',output:'static',trailingSlash:'always',server:{host:'0.0.0.0'},vite:{server:{allowedHosts:['terminal.local']}}});
