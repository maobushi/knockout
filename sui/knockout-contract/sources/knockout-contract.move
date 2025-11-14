/// Module: knockout-contract
/// カウンターのレジストリを持つメタコントラクト
module knockout_contract::knockout_contract {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::table::{Self, Table};

    /// カウンターオブジェクト
    struct Counter has key {
        id: UID,
        value: u64,
    }

    /// カウンターレジストリ（すべてのカウンターIDを管理）
    struct CounterRegistry has key {
        id: UID,
        counters: Table<u64, ID>, // インデックス -> カウンターID
        next_index: u64,
    }

    /// カウンター作成イベント
    struct CounterCreated has copy, drop {
        counter_id: ID,
        value: u64,
        index: u64,
    }

    /// カウンター増加イベント
    struct CounterIncremented has copy, drop {
        counter_id: ID,
        old_value: u64,
        new_value: u64,
    }

    /// レジストリが存在しない場合のエラー
    const ERegistryNotFound: u64 = 0;

    /// カウンターレジストリを作成する（一度だけ実行）
    public fun create_registry(ctx: &mut TxContext): CounterRegistry {
        CounterRegistry {
            id: object::new(ctx),
            counters: table::new(ctx),
            next_index: 0,
        }
    }

    /// レジストリを共有オブジェクトとして作成
    public entry fun create_and_share_registry(ctx: &mut TxContext) {
        transfer::share_object(create_registry(ctx));
    }

    /// 新しいカウンターを作成してレジストリに登録
    public entry fun create_and_register(
        registry: &mut CounterRegistry,
        ctx: &mut TxContext
    ) {
        let counter = Counter {
            id: object::new(ctx),
            value: 0,
        };
        
        let counter_id = object::id(&counter);
        let index = registry.next_index;
        
        // レジストリに登録
        table::add(&mut registry.counters, index, counter_id);
        registry.next_index = registry.next_index + 1;
        
        // イベントを発行
        event::emit(CounterCreated {
            counter_id,
            value: 0,
            index,
        });
        
        // カウンターを共有オブジェクトとして作成
        transfer::share_object(counter);
    }

    /// 新しいカウンターを作成する（レジストリなし、後方互換性のため）
    public fun create(ctx: &mut TxContext): Counter {
        let counter = Counter {
            id: object::new(ctx),
            value: 0,
        };
        
        event::emit(CounterCreated {
            counter_id: object::id(&counter),
            value: 0,
            index: 0, // レジストリなしの場合は0
        });
        
        counter
    }

    /// カウンターを取得可能なオブジェクトとして作成する（レジストリなし）
    public entry fun create_and_share(ctx: &mut TxContext) {
        transfer::share_object(create(ctx));
    }

    /// カウンターの値を増やす
    public entry fun increment(counter: &mut Counter) {
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

    /// レジストリ内のカウンター数を取得
    public fun registry_size(registry: &CounterRegistry): u64 {
        registry.next_index
    }

    /// レジストリからカウンターIDを取得（インデックス指定）
    public fun get_counter_id(registry: &CounterRegistry, index: u64): ID {
        *table::borrow(&registry.counters, index)
    }
}
