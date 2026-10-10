extern crate std;

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

use crate::{PillsNft, PillsNftClient};

fn bytes(e: &Env, value: u8) -> BytesN<32> {
    BytesN::from_array(e, &[value; 32])
}

fn setup(e: &Env) -> (PillsNftClient<'_>, Address) {
    let owner = Address::generate(e);
    let address = e.register(
        PillsNft,
        (
            String::from_str(e, "https://pills.social/api/nft/metadata/"),
            String::from_str(e, "Pills"),
            String::from_str(e, "PILL"),
            owner.clone(),
        ),
    );
    (PillsNftClient::new(e, &address), owner)
}

#[test]
fn registers_campaign_and_mints_numbered_pill() {
    let e = Env::default();
    let (client, owner) = setup(&e);
    let collector = Address::generate(&e);
    let campaign_ref = bytes(&e, 1);
    let content_hash = bytes(&e, 2);
    e.mock_all_auths();

    client.register_campaign(&owner, &campaign_ref, &content_hash, &2);
    client.mint(&owner, &collector, &42, &campaign_ref);

    assert_eq!(client.owner_of(&42), collector);
    assert_eq!(client.token_campaign(&42), Some(campaign_ref.clone()));
    assert_eq!(client.campaign(&campaign_ref).unwrap().minted, 1);
    assert_eq!(client.total_supply(), 1);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn refuses_mints_above_campaign_supply() {
    let e = Env::default();
    let (client, owner) = setup(&e);
    let collector = Address::generate(&e);
    let campaign_ref = bytes(&e, 3);
    e.mock_all_auths();

    client.register_campaign(&owner, &campaign_ref, &bytes(&e, 4), &1);
    client.mint(&owner, &collector, &1, &campaign_ref);
    client.mint(&owner, &collector, &2, &campaign_ref);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn pause_blocks_minting() {
    let e = Env::default();
    let (client, owner) = setup(&e);
    let campaign_ref = bytes(&e, 5);
    e.mock_all_auths();

    client.register_campaign(&owner, &campaign_ref, &bytes(&e, 6), &10);
    client.set_paused(&owner, &true);
    client.mint(&owner, &Address::generate(&e), &1, &campaign_ref);
}

#[test]
fn holder_can_burn_a_pill() {
    let e = Env::default();
    let (client, owner) = setup(&e);
    let collector = Address::generate(&e);
    let campaign_ref = bytes(&e, 7);
    e.mock_all_auths();

    client.register_campaign(&owner, &campaign_ref, &bytes(&e, 8), &10);
    client.mint(&owner, &collector, &9, &campaign_ref);
    client.burn(&collector, &9);

    assert_eq!(client.balance(&collector), 0);
    assert_eq!(client.total_supply(), 0);
}
