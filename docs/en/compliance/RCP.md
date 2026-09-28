# REGISTER OF PROCESSING ACTIVITIES (RCP) - SPORTS

| | |
|--|--|
| **Status** | PRE-PRODUCTION — working record |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-09-28 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../compliance/RCP.md) |
| **canonical_path** | docs/en/compliance/RCP.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | DPO / Legal |
| **Last reviewed** | 2026-09-28 |
| **Audience** | DPO, Legal, Product |

**Index:** [COMPLIANCE_INDEX.md](../../compliance/COMPLIANCE_INDEX.md) · **User FAQ:** [product/FAQ.md](../product/FAQ.md)

## 1. Controller / processor
The final legal operator entity and controller/processor allocation for each deployment model are not yet approved in production documentation. The public pilot remains NO-GO in the canonical T58 gate. Before processing real-user production data, document the operator identity, 4VELO/tenant roles and actual processors.

## 2. Categories of Personal Data
| Category | Data | Purpose |
| :--- | :--- | :--- |
| **Identification** | Email, Username, QR Code | Registration, login |
| **Localization** | GPS Tracks, Privacy Zones | Activity Tracking, Anti-cheat |
| **Profile / physiology** | Age, height, weight, fitness parameters | Profile configuration, scoring/analytics |
| **Health data** | Heart rate or metrics revealing physical/health status when enabled | Sports analytics |
| **Payment** | Transaction identifiers/status received from the payment provider | Subscriptions/rewards when enabled |

Height, weight, age and heart rate are not automatically GDPR biometric data. Biometric data has a narrower definition tied to specific technical processing for unique identification.

## 3. Lawful bases
A lawful basis must be documented per purpose. Article 6(1)(b) may cover only operations genuinely necessary to perform the service. Anti-cheat/security needs separate analysis, for example legitimate interest with a balancing test. Marketing requires an independent basis. If health data is enabled, an appropriate Article 9(2) condition is additionally required. Solely automated decisions with significant effects require a separate Article 22 assessment and user safeguards.

## 4. Data retention
The repository contains partial retention mechanisms and policy targets, but the current audit records no single verified retention matrix covering all personal-data stores. The 30/90-day values and earlier account-plus-one-year wording are policy targets, not proof of complete enforcement. Before pilot define: data type → store → retention → deletion/anonymization mechanism → test.

## 5. DPIA and pre-pilot state
The platform assessment is maintained in [DPIA_PLATFORM_CURRENT.md](./DPIA_PLATFORM_CURRENT.md). Until the legal items there and the existing T58 technical gate are closed, this record is PRE-PRODUCTION rather than a claim of full production compliance.
