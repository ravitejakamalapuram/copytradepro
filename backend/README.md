## How to Add a New Broker Integration

To add support for a new broker:

1. **Implement the Broker Service:**
   - Create a new file in `backend/src/services/` (e.g., `myBrokerService.ts`).
   - Implement the `IBrokerService` interface, including all required methods:
     - `login`, `logout`, `placeOrder`, `getOrderBook`, `getOrderStatus`, `getPositions`, `searchScrip`, `getQuotes`, `validateSession`, `extractAccountInfo`, `extractOrderInfo`, etc.
   - Encapsulate all broker-specific logic (API calls, payload mapping, status mapping) in this class.

2. **Update the Broker Factory:**
   - Add your new service to `brokerFactory.ts`:
     ```ts
     import { MyBrokerService } from './myBrokerService';
     // ...
     const brokerClassMap: Record<BrokerKey, any> = {
       shoonya: ShoonyaService,
       fyers: FyersService,
       mybroker: MyBrokerService, // Add this line
     };
     ```

3. **Add Broker Config (if needed):**
   - Add any required config to `brokerConfig.ts`.

4. **No Controller Changes Needed:**
   - The generic controllers will automatically support the new broker as long as it implements the interface.

5. **Test Thoroughly:**
   - Write unit and integration tests for your new broker service. 