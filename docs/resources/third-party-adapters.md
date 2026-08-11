---
layout:
  title:
    visible: true
  description:
    visible: false
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
---

# Third-Party Adapters

Because v5 wallet adapters are standalone packages, wallet providers can publish and maintain their own adapters. They work with use-wallet without requiring any changes to the core library, and wallet teams keep full ownership of their release cycle.

{% hint style="warning" %}
Third-party adapters are developed and maintained by their respective teams. TxnLab reviews adapters against the listing criteria below at the time of listing, but does not audit subsequent releases — a listing is not an endorsement or a guarantee of security or functionality. Always evaluate any wallet adapter, including reviewing its source code, before using it in your application. Listings may be added or removed at TxnLab's discretion.
{% endhint %}

Listed adapters appear in the [Supported Wallets](../getting-started/supported-wallets.md#third-party-adapters) page alongside the first-party wallets.

### Building an Adapter

An adapter package:

* Declares a peer dependency on `@txnlab/use-wallet` (`^5.0.0`) and `algosdk` (`^3.0.0`)
* Extends `BaseWallet` from the `@txnlab/use-wallet/adapter` subpath
* Exports a factory function returning a `WalletAdapterConfig`, plus a `WALLET_ID` constant
* Optionally declares `WalletCapabilities` (supported networks) and accepts the shared `metadata` factory option

The [Lute adapter](https://github.com/TxnLab/use-wallet/tree/main/packages/wallets/lute) is the reference implementation, and the [Custom Provider](../guides/custom-provider.md) guide covers the underlying wallet interface.

### Listing Criteria

To be listed in these docs, an adapter must:

1. **Have a public source repository**, linked from the npm package's `repository` field
2. **Use an open-source license** — MIT recommended (matching use-wallet), or another permissive [OSI-approved](https://opensource.org/licenses) license
3. **Follow the adapter contract** described above (a genuine adapter, not a fork of use-wallet)
4. **Be actively maintained**, with a public issue tracker for bug and security reports

Publishing with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) is strongly recommended — it verifiably links the published package to a build from the public repository. All first-party `@txnlab` packages publish with provenance.

Listings may be removed if a package becomes unmaintained or closed-source, or is reported to be harmful.

### Getting Listed

Open an issue or pull request on the [use-wallet repository](https://github.com/TxnLab/use-wallet) with a link to your adapter's npm package and source repository.
