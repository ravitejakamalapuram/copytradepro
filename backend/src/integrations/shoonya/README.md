# Shoonya Integration

This folder contains the Shoonya broker integration for CopyTrade Pro.

## Key Files
- `shoonyaService.ts`: Main service implementing IBrokerService for Shoonya.
- `__tests__/shoonyaService.test.ts`: Jest tests for Shoonya integration.

## API Quirks
- Shoonya requires TOTP for login (see `totpKey`).
- All requests use a session token (`susertoken`).
- Order symbols for NSE must end with `-EQ`.

## Required Config
- API keys, vendor code, and IMEI must be provided in the config or credentials.

## Testing
- Use Jest to run tests: `npm test` or `npx jest integrations/shoonya`
- Mock Shoonya API responses for unit tests. 