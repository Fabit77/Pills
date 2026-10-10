# Pills NFT contract

Soroban NFT contract for Pills. Each `collectible_claims` row maps to one
`token_id`; a registered campaign caps how many tokens may be minted from that
Pill.

## Pinned dependencies

- Soroban SDK `26.1.1`
- OpenZeppelin Stellar Contracts `0.7.2`

## Local verification

```bash
cargo test --manifest-path contracts/pills-nft/Cargo.toml
stellar contract build --manifest-path contracts/pills-nft/Cargo.toml
```

## Testnet deployment

Use a dedicated Testnet identity. Never place its secret in Git or expose it
through a `NEXT_PUBLIC_` environment variable.

```bash
stellar keys generate pills-testnet-deployer --network testnet --fund
stellar contract deploy \
  --network testnet \
  --source pills-testnet-deployer \
  --wasm contracts/pills-nft/target/wasm32v1-none/release/pills_nft.wasm \
  -- \
  --base_uri https://pills.social/api/nft/metadata/ \
  --name Pills \
  --symbol PILL \
  --owner "$(stellar keys address pills-testnet-deployer)"
```

Save the resulting contract ID and deployment transaction in `nft_contracts`,
then set `STELLAR_CONTRACT_ID` in the server environment.
