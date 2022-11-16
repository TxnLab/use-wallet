const resolve = require("@rollup/plugin-node-resolve").default;
const commonjs = require("@rollup/plugin-commonjs").default;
const typescript = require("rollup-plugin-typescript2");
const postcss = require("rollup-plugin-postcss");
const analyze = require("rollup-plugin-analyzer").default;
const dts = require("rollup-plugin-dts").default;
const pkg = require("./package.json");

module.exports = [
  {
    input: {
      index: "src/index.ts",
    },
    output: [
      {
        dir: "dist/cjs",
        format: "cjs",
        sourcemap: true,
      },
      {
        format: "esm",
        exports: "named",
        dir: "dist/esm",
      },
    ],
    external: [
      ...Object.keys(pkg.peerDependencies),
      ...Object.keys(pkg.devDependencies),
    ],
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        tsconfigOverride: {
          exclude: ["./src/components/*"],
        },
      }),
      postcss(),
      analyze(),
    ],
  },
  {
    input: "src/index.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [dts()],
  },
];
