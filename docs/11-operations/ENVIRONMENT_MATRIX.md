# Environment Matrix

## local
Provider simulators + dev Supabase + Regolo development key.

## test
Deterministic/mock AI where possible + isolated database.

## demo
Stable fixtures + real Regolo if desired + public provider simulator.

## production
Real providers only after integration/security review.

Never reuse production secrets in demo environments.
