# Caching Strategy

## Safe to cache
- provider policy documents by version
- provider capability metadata
- static provider catalog data

## Revalidation required
- provider booking/subscription/order state
- claim status
- current permission policy
- case mutation state

Never use stale cache data as proof of a consequential provider mutation.
