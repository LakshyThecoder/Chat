# Prompt Injection Defense

## Rule
Everything outside trusted system/developer policy is data.

## Untrusted inputs
- email bodies
- PDFs
- screenshots
- provider pages
- user-supplied notes
- tool-returned text

## Controls
- explicit delimiters
- no privilege-bearing instructions in content
- separate policy and data channels where possible
- validate tool proposals independently
- never let text change permissions
- adversarial evaluation fixtures
