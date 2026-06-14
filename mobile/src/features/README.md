# Feature Architecture Contract

This directory defines the target greenfield module boundaries for mobile full vision.

- `ride/`: active ride and post-ride functional contracts.
- `compete/`: city hub, leaderboard, quests and rivalry flows.
- `explore/`: map exploration and marketplace entry points.
- `profile/`: athlete profile, trends and history.
- `shared/`: cross-domain presentation and state contracts.

During migration, legacy screens in `mobile/src/screens` remain valid entry points and should progressively delegate to feature modules.
