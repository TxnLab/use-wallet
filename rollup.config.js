import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import postcss from "rollup-plugin-postcss";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import analyze from "rollup-plugin-analyzer";
import dts from "rollup-plugin-dts";

export default [
  {
    input: {
      index: "src/index.ts",
      constants: "src/constants/index.ts",
      providers: "src/providers/index.ts",
      "clients/algosigner": "src/clients/algosigner.ts",
      "clients/defly": "src/clients/defly.ts",
      "clients/exodus": "src/clients/exodus.ts",
      "clients/kmd": "src/clients/kmd.ts",
      "clients/myalgowallet": "src/clients/myalgowallet.ts",
      "clients/perawallet": "src/clients/perawallet.ts",
      "clients/walletconnect": "src/clients/walletconnect.ts",
    },
    output: [
      {
        dir: "dist/cjs",
        format: "cjs",
        sourcemap: true,
      },
      {
        dir: "dist/esm",
        format: "esm",
        sourcemap: true,
      },
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
      peerDepsExternal(),
      analyze(),
    ],
  },
  {
    input: "src/index.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [dts()],
  },
];
