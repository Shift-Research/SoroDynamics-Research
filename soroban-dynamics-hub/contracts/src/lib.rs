#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, Symbol, panic_with_error};

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    MultiplierOutOfRange = 3,
    Unauthorized = 4,
}

/// Storage keys for the pool contract.
#[contracttype]
pub enum DataKey {
    Admin,
    Balances,
    PriceMultiplier,
    TotalMinted,
    InitFlag,
}

/// The core Soroban contract simulating a dynamic-supply pool.
///
/// Balances are stored as raw base amounts, but `get_balance` applies a
/// global `PriceMultiplier` (in basis points, default 10000 = 1.0x) to
/// simulate elastic supply shifts. The admin can call
/// `trigger_supply_shift` to mutate this multiplier, creating artificial
/// value deltas that a tMEV-style searcher could attempt to arbitrage.
#[contract]
pub struct PoolContract;

#[contractimpl]
impl PoolContract {
    /// One-time initialisation. Sets the contract `admin` and seeds default
    /// state. Called directly after deployment.
    ///
    /// # Arguments
    /// * `admin` – Address authorised to mint and trigger supply shifts.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::InitFlag) {
            panic_with_error!(&env, ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::InitFlag, &true);
        env.storage().instance().set(&DataKey::Admin, &admin);
        // 10000 bp = 1.0000 × multiplier (no shift).
        env.storage().instance().set(&DataKey::PriceMultiplier, &10000u32);
        env.storage().instance().set(&DataKey::TotalMinted, &0i128);

        env.events().publish(("pool", "initialize"), (admin,));
    }

    /// Mints `amount` raw tokens to `to`. Only the admin may call this.
    /// Emits a `("pool", "mint")` event.
    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotInitialized));
        admin.require_auth();

        let mut balances: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::Balances)
            .unwrap_or(Map::new(&env));
        let prev = balances.get(to.clone()).unwrap_or(0);
        balances.set(to.clone(), prev + amount);
        env.storage().instance().set(&DataKey::Balances, &balances);

        let mut total_minted: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalMinted)
            .unwrap_or(0);
        total_minted += amount;
        env.storage()
            .instance()
            .set(&DataKey::TotalMinted, &total_minted);

        env.events()
            .publish(("pool", "mint"), (to, amount, total_minted));
    }

    /// Returns the **effective** balance of `account`.
    ///
    /// Effective balance = `raw_balance × (price_multiplier / 10000)`.
    /// This is the core mechanism that lets a single admin transaction
    /// revalue *every* holder’s displayed balance simultaneously.
    pub fn get_balance(env: Env, account: Address) -> i128 {
        let balances: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::Balances)
            .unwrap_or(Map::new(&env));
        let base = balances.get(account).unwrap_or(0);
        let mult: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PriceMultiplier)
            .unwrap_or(10000);
        (base as i128) * (mult as i128) / 10000
    }

    /// Returns the raw (unscaled) balance of `account`.
    pub fn get_raw_balance(env: Env, account: Address) -> i128 {
        let balances: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&DataKey::Balances)
            .unwrap_or(Map::new(&env));
        balances.get(account).unwrap_or(0)
    }

    /// Admin-only function that abruptly changes the global price
    /// multiplier to `new_mult_bp` (basis points).
    ///
    /// When `new_mult_bp` ≠ current multiplier every holder’s effective
    /// balance (as reported by `get_balance`) shifts, creating a
    /// window for simulated arbitrage / tMEV extraction.
    ///
    /// # Arguments
    /// * `new_mult_bp` – New multiplier in basis points (0 … 50 000).
    ///   E.g. 5 000 = 0.5×, 20 000 = 2.0×.
    pub fn trigger_supply_shift(env: Env, new_mult_bp: u32) {
        if new_mult_bp > 50_000 {
            panic_with_error!(&env, ContractError::MultiplierOutOfRange);
        }
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotInitialized));
        admin.require_auth();

        let old_mult: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PriceMultiplier)
            .unwrap_or(10000);
        env.storage()
            .instance()
            .set(&DataKey::PriceMultiplier, &new_mult_bp);
        let total_minted: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalMinted)
            .unwrap_or(0);

        env.events()
            .publish(("pool", "supply_shift"), (old_mult, new_mult_bp, total_minted));
    }

    // -----------------------------------------------------------------
    //  Read-only helpers
    // -----------------------------------------------------------------

    pub fn get_multiplier(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::PriceMultiplier)
            .unwrap_or(10000)
    }

    pub fn get_total_minted(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalMinted)
            .unwrap_or(0)
    }
}

// -----------------------------------------------------------------------
//  Unit tests  (run with `cargo test`)
// -----------------------------------------------------------------------
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, vec, Env, IntoVal};

    #[test]
    fn test_initialize_and_mint() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PoolContract);
        let client = PoolContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.initialize(&admin);
        client.mint(&admin, &user, &1000);

        let raw_balance = client.get_raw_balance(&user);
        assert_eq!(raw_balance, 1000);

        let eff_balance = client.get_balance(&user);
        assert_eq!(eff_balance, 1000); // multiplier still 1.0
    }

    #[test]
    fn test_supply_shift_halves_effective_balance() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PoolContract);
        let client = PoolContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.initialize(&admin);
        client.mint(&admin, &user, &1000);

        // Drop multiplier to 0.5× (5000 bp)
        client.trigger_supply_shift(&admin, &5000);

        let eff = client.get_balance(&user);
        assert_eq!(eff, 500); // 1000 × 0.5

        // Raw (base) balance unchanged
        let raw = client.get_raw_balance(&user);
        assert_eq!(raw, 1000);
    }

    #[test]
    fn test_supply_shift_doubles_effective_balance() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PoolContract);
        let client = PoolContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.initialize(&admin);
        client.mint(&admin, &user, &500);

        // Raise multiplier to 2.0×
        client.trigger_supply_shift(&admin, &20000);

        let eff = client.get_balance(&user);
        assert_eq!(eff, 1000);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #3)")]
    fn test_multiplier_out_of_range() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PoolContract);
        let client = PoolContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);
        client.trigger_supply_shift(&admin, &99_999);
    }

    #[test]
    #[should_panic(expected = "HostError: Error(Contract, #2)")]
    fn test_mint_before_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PoolContract);
        let client = PoolContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        client.mint(&admin, &user, &100);
    }
}
