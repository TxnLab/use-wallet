#!/bin/bash

find examples -type f -name "*" -print0 | xargs -0 sed -i -e  "s~use-wallet~avm-wallet~g" -e  "s~@txnlab~@biatec~g" -e  "s~github.com/txnlab/avm-wallet~github.com/scholtz/avm-wallet~g" -e 's~"directory": "packages/avm-wallet~"directory": "packages/use-wallet~g' -e "s~github/package-json/v/TxnLab/avm-wallet~github/package-json/v/scholtz/avm-wallet~g" -e "s~github/license/TxnLab/avm-wallet~github/license/scholtz/avm-wallet~g" -e "s~github.com/TxnLab/avm-wallet~github.com/scholtz/avm-wallet~g"
find packages -type f -name "*" -print0 | xargs -0 sed -i -e  "s~use-wallet~avm-wallet~g" -e  "s~@txnlab~@biatec~g" -e  "s~github.com/txnlab/avm-wallet~github.com/scholtz/avm-wallet~g" -e 's~"directory": "packages/avm-wallet~"directory": "packages/use-wallet~g' -e "s~github/package-json/v/TxnLab/avm-wallet~github/package-json/v/scholtz/avm-wallet~g" -e "s~github/license/TxnLab/avm-wallet~github/license/scholtz/avm-wallet~g" -e "s~github.com/TxnLab/avm-wallet~github.com/scholtz/avm-wallet~g"

sed -i -e 's~@txnlab~@biatec~g' -e 's~use-wallet~avm-wallet~g' package.json


sed -i -e 's~@txnlab~@biatec~g' -e 's~use-wallet~avm-wallet~g' -e 's~TxnLab/use-wallet~scholtz/avm-wallet~g' -e 's~gitbook.io/avm-wallet~gitbook.io/use-wallet~g' README.md
sed -i -e 's~@txnlab~@biatec~g' -e 's~use-wallet~avm-wallet~g' CONTRIBUTING.md
sed -i -e 's~TxnLab Inc.~TxnLab Inc., Scholtz \& Company, jsa~g' -e 's~Scholtz \& Company, jsa, Scholtz \& Company, jsa~Scholtz \& Company, jsa~g' LICENSE.md
dir=$(pwd)
echo $dir
cd $dir && cd packages/use-wallet && pnpm link --global
cd $dir && cd packages/use-wallet-vue && pnpm link @biatec/avm-wallet
cd $dir && cd packages/use-wallet-react && pnpm link @biatec/avm-wallet
cd $dir && cd packages/use-wallet-solid && pnpm link @biatec/avm-wallet
