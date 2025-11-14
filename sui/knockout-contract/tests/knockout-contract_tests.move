#[test_only]
module knockout_contract::knockout_contract_tests {
    use knockout_contract::knockout_contract::{Self, Counter, CounterRegistry};
    use sui::test_scenario;

    const ADMIN: address = @0xA;

    #[test]
    fun test_create_and_increment() {
        let scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        // カウンターを作成
        knockout_contract::create_and_share(ctx);
        test_scenario::next_tx(&mut scenario, ADMIN);
        
        // カウンターを取得
        let counter = test_scenario::take_shared<Counter>(&scenario);
        
        // 初期値は0であることを確認
        assert!(knockout_contract::value(&counter) == 0, 0);
        
        // カウンターを増やす
        test_scenario::next_tx(&mut scenario, ADMIN);
        knockout_contract::increment(&mut counter);
        
        // 値が1になったことを確認
        assert!(knockout_contract::value(&counter) == 1, 1);
        
        // もう一度増やす
        test_scenario::next_tx(&mut scenario, ADMIN);
        knockout_contract::increment(&mut counter);
        assert!(knockout_contract::value(&counter) == 2, 2);
        
        // カウンターを返す
        test_scenario::return_shared(counter);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_registry() {
        let scenario = test_scenario::begin(ADMIN);
        let ctx = test_scenario::ctx(&mut scenario);
        
        // レジストリを作成
        knockout_contract::create_and_share_registry(ctx);
        test_scenario::next_tx(&mut scenario, ADMIN);
        let registry = test_scenario::take_shared<CounterRegistry>(&scenario);
        
        // レジストリの初期サイズは0
        assert!(knockout_contract::registry_size(&registry) == 0, 0);
        
        // カウンターを作成してレジストリに登録
        test_scenario::next_tx(&mut scenario, ADMIN);
        let ctx2 = test_scenario::ctx(&mut scenario);
        knockout_contract::create_and_register(&mut registry, ctx2);
        
        // レジストリのサイズが1になったことを確認
        assert!(knockout_contract::registry_size(&registry) == 1, 1);
        
        // カウンターIDを取得
        let counter_id = knockout_contract::get_counter_id(&registry, 0);
        
        // カウンターを取得
        test_scenario::next_tx(&mut scenario, ADMIN);
        let counter = test_scenario::take_shared_by_id<Counter>(&scenario, counter_id);
        
        // 初期値は0であることを確認
        assert!(knockout_contract::value(&counter) == 0, 0);
        
        // カウンターを返す
        test_scenario::return_shared(counter);
        test_scenario::return_shared(registry);
        test_scenario::end(scenario);
    }
}
