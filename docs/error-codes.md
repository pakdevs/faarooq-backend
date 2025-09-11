# Error Code Catalog

| Code               | HTTP | Description                                      |
| ------------------ | ---- | ------------------------------------------------ |
| auth_missing_token | 401  | Authorization header missing or not Bearer token |
| auth_invalid_token | 401  | Token invalid or expired                         |
| auth_token_revoked | 401  | Token explicitly revoked (logout/jti)            |
| auth_misconfigured | 500  | Server missing JWT secret configuration          |
| unauthorized       | 401  | Generic auth failure (legacy placeholder)        |
| forbidden          | 403  | Authenticated but lacks permission               |
| not_found          | 404  | Resource not found                               |
| rate_limited       | 429  | Rate limit exceeded for action/window            |
| server_error       | 500  | Unhandled internal error                         |

Conventions:

- Stable codes (snake_case) guaranteed not to change without deprecation notice.
- Error schema: { error: { code, message, details? } }.
- Add new codes below; do not repurpose existing codes.
