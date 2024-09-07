#!/bin/bash

find examples -type f -name "*" -print0 | xargs -0 sed -i -e  "s~use-wallet~avm-wallet~g" -e  "s~@txnlab~@biatec~g" -e  "s~github.com/txnlab/avm-wallet~github.com/scholtz/avm-wallet~g" -e 's~"directory": "packages/avm-wallet~"directory": "packages/use-wallet~g' -e "s~github/package-json/v/TxnLab/avm-wallet~github/package-json/v/scholtz/avm-wallet~g" -e "s~github/license/TxnLab/avm-wallet~github/license/scholtz/avm-wallet~g" -e "s~github.com/TxnLab/avm-wallet~github.com/scholtz/avm-wallet~g"
find packages -type f -name "*" -print0 | xargs -0 sed -i -e  "s~use-wallet~avm-wallet~g" -e  "s~@txnlab~@biatec~g" -e  "s~github.com/txnlab/avm-wallet~github.com/scholtz/avm-wallet~g" -e 's~"directory": "packages/avm-wallet~"directory": "packages/use-wallet~g' -e "s~github/package-json/v/TxnLab/avm-wallet~github/package-json/v/scholtz/avm-wallet~g" -e "s~github/license/TxnLab/avm-wallet~github/license/scholtz/avm-wallet~g" -e "s~github.com/TxnLab/avm-wallet~github.com/scholtz/avm-wallet~g"

find examples -type f -name "*" -print0 | xargs -0 sed -i -e "s~@biatec/avm-wallet~avm-wallet~g"
find packages -type f -name "*" -print0 | xargs -0 sed -i -e "s~@biatec/avm-wallet~avm-wallet~g"

sed -i -e 's~@txnlab~@biatec~g' -e 's~use-wallet~avm-wallet~g' -e 's~github.com/txnlab~github.com/scholtz~g' -e 's~@biatec/~~g' package.json


sed -i -e 's~@txnlab~@biatec~g' -e 's~use-wallet~avm-wallet~g' -e 's~TxnLab/use-wallet~scholtz/avm-wallet~g' -e 's~gitbook.io/avm-wallet~gitbook.io/use-wallet~g' README.md
sed -i -e 's~@txnlab~@biatec~g' -e 's~use-wallet~avm-wallet~g' CONTRIBUTING.md

sed -i -e 's~@biatec/~~g' -e 's~gitbook.io/avm-wallet~gitbook.io/use-wallet~g' README.md
sed -i -e 's~@biatec/~~g' CONTRIBUTING.md

sed -i -e 's~TxnLab Inc.~TxnLab Inc., Scholtz \& Company, jsa~g' -e 's~Scholtz \& Company, jsa, Scholtz \& Company, jsa~Scholtz \& Company, jsa~g' LICENSE.md
dir=$(pwd)
echo $dir
cd $dir && cd packages/use-wallet && pnpm link --global
cd $dir && cd packages/use-wallet-vue && pnpm link avm-wallet && pnpm link --global
cd $dir && cd packages/use-wallet-react && pnpm link avm-wallet  && pnpm link --global
cd $dir && cd packages/use-wallet-solid && pnpm link avm-wallet  && pnpm link --global


cd $dir && cd examples/nextjs && pnpm link avm-wallet
cd $dir && cd examples/nuxt && pnpm link avm-wallet  && pnpm link avm-wallet-vue
cd $dir && cd examples/react-ts && pnpm link avm-wallet-react
cd $dir && cd examples/solid-ts && pnpm link avm-wallet-solid
cd $dir && cd examples/vanilla-ts && pnpm link avm-wallet
cd $dir && cd examples/vue-ts && pnpm link avm-wallet-vue
