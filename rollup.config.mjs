import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import postcss from "rollup-plugin-postcss";
import analyze from "rollup-plugin-analyzer";
import dts from "rollup-plugin-dts";
import pkg from "./package.json" assert { type: "json" };

export default [
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
