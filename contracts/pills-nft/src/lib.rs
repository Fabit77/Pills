#![no_std]

mod contract;

pub use contract::{Campaign, PillsNft, PillsNftClient};

#[cfg(test)]
mod test;
