# WebMCP Exposure Notes

WebMCP supports tool registration and exposure rules in the current specification.
Provider implementation should deliberately scope which tools are exposed to which contexts/origins where the platform supports it.

Do not expose administrative/provider-reset tools to general agent contexts.
