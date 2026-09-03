# Tool Catalog

## FlyRight
get_booking — READ
get_flight_status — READ
get_policy — READ
calculate_compensation — READ/CALCULATE
submit_claim — HIGH_IMPACT
get_claim_status — READ
request_follow_up — MUTATE

## Streamly
get_subscription — READ
get_billing_history — READ
get_cancellation_policy — READ
cancel_subscription — HIGH_IMPACT
request_refund — HIGH_IMPACT
get_case_status — READ

## ElectroMart
get_order — READ
get_return_policy — READ
get_warranty — READ
create_return — MUTATE
submit_warranty_claim — HIGH_IMPACT
get_case_status — READ

## Naming
Name capabilities after user/business actions, not DOM interactions.
Bad: clickRefundButton
Good: request_refund
