import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";

export default {
  input: "src/main.tsx",
  output: {
    file: "main.js",
    format: "cjs",
    sourcemap: "inline"
  },
  external: ["obsidian"],
  plugins: [
    nodeResolve({ browser: true }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
    postcss({
      // If you want a separate CSS file:
      extract: "styles.css", 
      // If you prefer to inject styles into JS, omit `extract` or set it to false.
    })
  ]
};
