# Fyers Integration

This folder contains the Fyers broker integration for CopyTrade Pro.

## Key Files
- `fyersService.ts`: Main service implementing IBrokerService for Fyers.
- `__tests__/fyersService.test.ts`: Jest tests for Fyers integration.

## API Quirks
- Fyers uses OAuth for login; requires an auth code and access token.
- All requests require a valid access token.

## Required Config
- Client ID, secret key, and redirect URI must be provided in the config or credentials.

## Testing
- Use Jest to run tests: `npm test` or `npx jest integrations/fyers`
- Mock Fyers API responses for unit tests. 