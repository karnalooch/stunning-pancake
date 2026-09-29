# Gumball consumer runtime

4VELO vendors the trusted Proof Broker runtime from
`karnalooch/engineering-platform` **Gumball v0.6.0**.

Local policy is intentionally narrow:

- heavyweight Android release proof is explicit-only on pull requests;
- no PR automatically compiles an APK;
- the existing 4VELO classifier and caller-local Aggregate CI gate remain authoritative;
- manual/nightly/tag/reusable release execution still requires Android proof.

Promote reusable consumer improvements back to Gumball instead of silently
diverging this copy.
