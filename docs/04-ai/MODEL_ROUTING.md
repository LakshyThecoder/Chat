# Model Routing

## Fast model
Use for:
- classification
- simple extraction
- short transformations

## Reasoning model
Use for:
- ambiguous timeline synthesis
- strategy comparison
- complex policy interpretation

## Vision-capable model
Use for:
- screenshots
- receipt images
- product-condition evidence

## Routing policy
Default to the cheapest model that meets the task's measured quality threshold.
Do not route every request to the strongest model.

## Regolo
Model availability and capabilities may change. The app should support configurable model IDs and can query Regolo's model catalog when operating tooling/admin features.
