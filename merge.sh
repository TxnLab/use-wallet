git checkout -b v3.5.0
git pull git@github.com:TxnLab/use-wallet.git v3.5.0 --no-rebase --strategy-option theirs  -X theirs
./renmae.sh
pnpm install
pnpm build:packages
pnpm build:examples
pnpm publish