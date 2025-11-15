/// Module: knockout-contract
/// カウンターのレジストリを持つメタコントラクト
module knockout_contract::knockout_contract {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::table::{Self, Table};

    /// カウンターオブジェクト（セッションキー対応）
    struct Counter has key {
        id: UID,
        main_owner: address,      // メインウォレットのアドレス
        session_owner: address,   // セッションキーのアドレス
        value: u64,
    }

    /// カウンターレジストリ（main_ownerでインデックス）
    struct CounterRegistry has key {
        id: UID,
        counters: Table<address, ID>, // main_owner -> カウンターID
    }

    /// カウンター作成イベント
    struct CounterCreated has copy, drop {
        counter_id: ID,
        main_owner: address,
        session_owner: address,
        value: u64,
    }

    /// カウンター増加イベント
    struct CounterIncremented has copy, drop {
        counter_id: ID,
        old_value: u64,
        new_value: u64,
    }

    /// 権限エラー
    const E_NOT_AUTHORIZED: u64 = 1;
    /// カウンターが存在しないエラー
    const E_COUNTER_NOT_FOUND: u64 = 2;

    /// カウンターレジストリを作成する（一度だけ実行）
    public fun create_registry(ctx: &mut TxContext): CounterRegistry {
        CounterRegistry {
            id: object::new(ctx),
            counters: table::new(ctx),
        }
    }

    /// レジストリを共有オブジェクトとして作成し、即時にカウンターを発行
    /// session_owner で署名するトランザクションに対応するアドレスを登録する
    public entry fun create_and_share_registry(session_owner: address, ctx: &mut TxContext) {
        let registry = create_registry(ctx);
        {
            let registry_ref = &mut registry;
            create_or_replace_counter(registry_ref, session_owner, ctx);
        };
        transfer::share_object(registry);
    }

    /// 新しいカウンターを作成してレジストリに登録（共通処理）
    fun create_or_replace_counter(
        registry: &mut CounterRegistry,
        session_owner: address,
        ctx: &mut TxContext,
    ) {
        let main_owner = tx_context::sender(ctx);

        // 既存エントリを削除（必要であれば）
        if (table::contains(&registry.counters, main_owner)) {
            let _old_counter_id = table::remove(&mut registry.counters, main_owner);
        };

        let counter = Counter {
            id: object::new(ctx),
            main_owner,
            session_owner,
            value: 0,
        };

        let counter_id = object::id(&counter);
        table::add(&mut registry.counters, main_owner, counter_id);

        event::emit(CounterCreated {
            counter_id,
            main_owner,
            session_owner,
            value: 0,
        });

        transfer::share_object(counter);
    }

    /// カウンターを初期化（メインウォレットで実行）
    /// セッションキーのアドレスを紐づけてカウンターを発行
    /// 既存のカウンターが存在する場合は、レジストリから削除してから新しいカウンターを作成
    public entry fun initialize_counter(
        registry: &mut CounterRegistry,
        session_owner: address,
        ctx: &mut TxContext
    ) {
        create_or_replace_counter(registry, session_owner, ctx);
    }

    /// カウンターの値を増やす（セッションキーで署名して実行）
    public entry fun increment(
        counter: &mut Counter,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // セッションキー または メインウォレットで署名されているかチェック
        assert!(sender == counter.session_owner || sender == counter.main_owner, E_NOT_AUTHORIZED);

        let old_value = counter.value;
        counter.value = counter.value + 1;
        
        event::emit(CounterIncremented {
            counter_id: object::id(counter),
            old_value,
            new_value: counter.value,
        });
    }

    /// カウンターの現在の値を取得する
    public fun value(counter: &Counter): u64 {
        counter.value
    }

    /// カウンターを取得（main_ownerで検索）
    public fun get_counter_id(registry: &CounterRegistry, main_owner: address): ID {
        assert!(table::contains(&registry.counters, main_owner), E_COUNTER_NOT_FOUND);
        *table::borrow(&registry.counters, main_owner)
    }

    /// メインオーナーのアドレスを取得
    public fun main_owner(counter: &Counter): address {
        counter.main_owner
    }

    /// セッションオーナーのアドレスを取得
    public fun session_owner(counter: &Counter): address {
        counter.session_owner
    }
}
