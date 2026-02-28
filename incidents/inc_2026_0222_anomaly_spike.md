# Incident Report: INC-2026-0222

## Summary
The Isolation Forest anomaly detection model flagged 25% of transactions as anomalous (baseline: 2–3%), triggered by a legitimate large-scale promotional event that shifted normal transaction patterns.

## Severity
P2

## Timeline
- 08:00 — Partner company launched flash sale promotion (50% off, heavily marketed)
- 09:00 — Transaction volume increased 4x from baseline
- 09:15 — Monitoring agent detected anomaly rate 12% (warning threshold: 5%)
- 09:20 — Diagnostic agent investigation: drift scores slightly elevated but not critical
- 09:30 — Anomaly rate reached 25% (critical)
- 09:35 — Diagnostic agent queried: transactions flagged as anomalous showed common pattern — small amounts ($5–$20), high frequency, same merchant category
- 09:40 — RAG system returned no direct match but suggested promotional event as possible cause
- 09:45 — Manual verification: confirmed flash sale promotion driving unusual but legitimate volume
- 10:00 — Decision: adjust Isolation Forest contamination parameter from 0.02 to 0.10 temporarily
- 10:05 — Parameter updated, anomaly rate dropped to 8%
- 10:10 — Further adjusted to 0.15 based on expected promotional pattern
- 10:15 — Anomaly rate normalized to ~5% (acceptable during promotional events)
- 18:00 — Flash sale ended, transaction patterns returning to normal
- 20:00 — Contamination parameter reverted to 0.02
- 20:30 — Anomaly rate returned to baseline 2–3%

## Root Cause
The Isolation Forest model's contamination parameter was set to 0.02 (expecting 2% anomaly rate), calibrated on normal transaction patterns. The flash sale created a burst of transactions with characteristics that differed from the training distribution:
- High frequency of small-value transactions from a single merchant category
- Unusual time-of-day patterns (concentrated during sale hours)
- Geographic concentration (targeted marketing regions)

These legitimate transactions appeared as outliers to the Isolation Forest because they didn't match the learned "normal" distribution.

## Resolution
1. Temporarily increased contamination parameter during the promotional event.
2. Created a "promotional event mode" configuration that can be activated proactively.
3. Added promotional event calendar integration to anticipate future events.
4. Evaluated adaptive contamination threshold based on rolling transaction volume.

## Lessons Learned
- Known business events (promotions, sales, holidays) should be communicated to the ML platform team in advance.
- Created a business events calendar that proactively adjusts anomaly detection thresholds.
- The Isolation Forest model should incorporate transaction volume as a context feature.
- Added a "promotional event" flag to the feature pipeline that can be set via API.
- False positive fatigue: the fraud review team ignored many alerts during this period, which could mask real fraud during promotions.

## Affected Components
- Isolation Forest anomaly detection model (anomaly_v1)
- Fraud review queue (overwhelmed with false positives)
- Transaction processing (no impact — anomaly flags are informational, not blocking)
