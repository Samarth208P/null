# ENS Sepolia deployment ABIs

`sepolia-contracts.json` contains the public addresses and the subset of ABIs used by the NULL setup commands. They were extracted from the official ENS [contracts-v2 deployment artifacts](https://github.com/ensdomains/contracts-v2/tree/97a57293f3b4279d94b571e678edb53ce62638f4/contracts/deployments/sepolia), source revision `97a57293f3b4279d94b571e678edb53ce62638f4`. The corresponding ENS source is MIT licensed; authorship belongs to ENS and the referenced upstream dependencies.

The browser uses the small typed interfaces in `packages/ens`, not these setup artifacts. No RPC credential or signing key belongs in this file. Update the addresses and supported resolver implementation together after reviewing an ENS beta upgrade.
