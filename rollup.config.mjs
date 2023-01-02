import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import externals from "rollup-plugin-node-externals";
import pkg from "./package.json" assert { type: "json" };

export default [
  // browser-friendly UMD build
  {
    input: "src/main.js",
    output: {
      name: "frictionless-js-browser",
      file: pkg.browser,
      format: "umd",
    },
    plugins: [
      externals(),
      json(),
      commonjs(), // so Rollup can convert `ms` to an ES module
      nodeResolve(), // so Rollup can find `ms`
    ],
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  {
    input: "src/main.js",
    external: ["ms"],
    output: [
      { file: pkg.main, format: "cjs" },
      { file: pkg.module, format: "es" },
    ],
  },
];
