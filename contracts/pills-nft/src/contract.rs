use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, String,
};
use stellar_tokens::non_fungible::{
    burnable::NonFungibleBurnable,
    enumerable::{Enumerable, NonFungibleEnumerable},
    Base, NonFungibleToken,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub content_hash: BytesN<32>,
    pub max_supply: u32,
    pub minted: u32,
}

#[contracttype]
pub enum DataKey {
    Owner,
    Paused,
    Campaign(BytesN<32>),
    TokenCampaign(u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PillsNftError {
    Unauthorized = 1,
    Paused = 2,
    InvalidSupply = 3,
    CampaignAlreadyRegistered = 4,
    CampaignNotFound = 5,
    SupplyExhausted = 6,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignRegistered {
    #[topic]
    pub campaign_ref: BytesN<32>,
    pub content_hash: BytesN<32>,
    pub max_supply: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PillMinted {
    #[topic]
    pub campaign_ref: BytesN<32>,
    #[topic]
    pub to: Address,
    pub token_id: u32,
}

#[contract]
pub struct PillsNft;

impl PillsNft {
    fn require_owner(e: &Env, caller: &Address) {
        caller.require_auth();
        let owner: Address = e
            .storage()
            .instance()
            .get(&DataKey::Owner)
            .expect("owner should be set");
        if owner != *caller {
            panic_with_error!(e, PillsNftError::Unauthorized);
        }
    }

    fn require_active(e: &Env) {
        if e.storage().instance().get(&DataKey::Paused).unwrap_or(false) {
            panic_with_error!(e, PillsNftError::Paused);
        }
    }
}

#[contractimpl]
impl PillsNft {
    pub fn __constructor(
        e: &Env,
        base_uri: String,
        name: String,
        symbol: String,
        owner: Address,
    ) {
        e.storage().instance().set(&DataKey::Owner, &owner);
        e.storage().instance().set(&DataKey::Paused, &false);
        Base::set_metadata(e, base_uri, name, symbol);
    }

    pub fn owner(e: &Env) -> Address {
        e.storage()
            .instance()
            .get(&DataKey::Owner)
            .expect("owner should be set")
    }

    pub fn paused(e: &Env) -> bool {
        e.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    pub fn set_paused(e: &Env, caller: Address, paused: bool) {
        Self::require_owner(e, &caller);
        e.storage().instance().set(&DataKey::Paused, &paused);
    }

    pub fn register_campaign(
        e: &Env,
        caller: Address,
        campaign_ref: BytesN<32>,
        content_hash: BytesN<32>,
        max_supply: u32,
    ) {
        Self::require_owner(e, &caller);
        Self::require_active(e);
        if max_supply == 0 {
            panic_with_error!(e, PillsNftError::InvalidSupply);
        }

        let key = DataKey::Campaign(campaign_ref.clone());
        if e.storage().persistent().has(&key) {
            panic_with_error!(e, PillsNftError::CampaignAlreadyRegistered);
        }

        e.storage().persistent().set(
            &key,
            &Campaign {
                content_hash: content_hash.clone(),
                max_supply,
                minted: 0,
            },
        );
        CampaignRegistered { campaign_ref, content_hash, max_supply }.publish(e);
    }

    pub fn campaign(e: &Env, campaign_ref: BytesN<32>) -> Option<Campaign> {
        e.storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_ref))
    }

    pub fn mint(
        e: &Env,
        caller: Address,
        to: Address,
        token_id: u32,
        campaign_ref: BytesN<32>,
    ) {
        Self::require_owner(e, &caller);
        Self::require_active(e);

        let campaign_key = DataKey::Campaign(campaign_ref.clone());
        let mut campaign: Campaign = e
            .storage()
            .persistent()
            .get(&campaign_key)
            .unwrap_or_else(|| panic_with_error!(e, PillsNftError::CampaignNotFound));
        if campaign.minted >= campaign.max_supply {
            panic_with_error!(e, PillsNftError::SupplyExhausted);
        }

        Enumerable::non_sequential_mint(e, &to, token_id);
        campaign.minted += 1;
        e.storage().persistent().set(&campaign_key, &campaign);
        e.storage()
            .persistent()
            .set(&DataKey::TokenCampaign(token_id), &campaign_ref);
        PillMinted { campaign_ref, to, token_id }.publish(e);
    }

    pub fn token_campaign(e: &Env, token_id: u32) -> Option<BytesN<32>> {
        e.storage().persistent().get(&DataKey::TokenCampaign(token_id))
    }
}

#[contractimpl(contracttrait)]
impl NonFungibleToken for PillsNft {
    type ContractType = Enumerable;
}

#[contractimpl(contracttrait)]
impl NonFungibleEnumerable for PillsNft {}

#[contractimpl(contracttrait)]
impl NonFungibleBurnable for PillsNft {}
