# Video script (< 3 minutes)

Public YouTube, voice on, one URL: https://aegis-chamber.vercel.app

## Shot list

1. **Broken flight (0:00–0:20)** Show CDG → FCO, cancelled, €183.40 fare plus €250 EU261. “Aegis turns airline email into an executable passenger-rights case.”
2. **Agent-native page (0:20–0:40)** Open the URL beside ChatGPT. Show **Agent connected**. Say: **“Check my airline email and tell me what I’m owed.”**
3. **Shared control plane (0:40–1:10)** ChatGPT calls `scan_airline_mail`, `get_travel_graph`, then `begin_resolution`. The same visible inbox, trip, and amount update. Promo mail becomes a watched future trip.
4. **Permission boundary (1:10–1:30)** Call `execute_filing` before approval. Show `APPROVAL_REQUIRED`. “The model can propose. It cannot sign.”
5. **Human signature (1:30–1:50)** Approve €183.40 on the page. Explain that deterministic software owns the amount.
6. **Cross-site action (1:50–2:20)** Say **“Continue.”** The agent files at the FlyRight provider tool surface.
7. **Provider verification (2:20–2:40)** `verify_filing` re-reads the carrier row. Expected and observed match. Select FR0999 / BERG and show duplicate protection.
8. **Close (2:40–2:55)** “The inbox finds the right. WebMCP gives the agent hands. The person keeps control. Success is a provider match.”

Do not show login, old OS surfaces, Streamly, or CodeForge.
