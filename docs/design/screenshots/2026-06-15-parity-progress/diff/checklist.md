# Vision parity checklist (human gate)

SSIM is directional only (mocks are illustrations, ROI-masked comparison).
Mark each dimension [x] when the built screen matches the vision mock.
Auto-filled items come from `scripts/parity_manifest.json`.

| Screen | SSIM | layout | typography | assets | data | empty-state |
|--------|------|--------|------------|--------|------|-------------|
| 00_main_after_onboarding.png | — | header present, tab bar, 1 card(s) | Silkscreen, Silkscreen | scene, scene=sky_day | fixtures=RIDE_DASHBOARD | no empty-state |
| 00_onboarding_city.png | 0.6846 | header present, 1 card(s) | Silkscreen, Silkscreen | crests, frame | fixtures=ONBOARDING | no empty-state |
| 00_onboarding_complete.png | 0.4667 | tab bar | Silkscreen, Silkscreen | [ ] | fixtures=SHELL | no empty-state |
| 00_onboarding_department.png | 0.6532 | header present | Silkscreen, Silkscreen | department_icons, frame, scene, scene=sky_sunset | fixtures=ONBOARDING | no empty-state |
| 00_onboarding_finish.png | 0.5013 | header present, 1 card(s) | Silkscreen, Silkscreen | finish_meta, frame, scene, scene=sky_sunset | fixtures=ONBOARDING | no empty-state |
| 01_ride_dashboard.png | 0.4697 | header present, tab bar, 4 card(s), sections: hero, quest, last_ride, weekly | Silkscreen, Silkscreen, label_count: 8 | avatar, level_bar, streak_badge, scene, scene=sky_day | fixtures=RIDE_DASHBOARD, dynamic values | no empty-state |
| 02_active_ride_hud.png | 0.5888 | sections: status_bar, nav_hint, data_grid, action_bar | VT323, Silkscreen | map, scene, scene=sky_day | fixtures=RIDE_METRICS, dynamic values | no empty-state |
| 03_ride_paused.png | 0.589 | [ ] | Silkscreen | icon | fixtures=PAUSED | no empty-state |
| 03b_ride_stopped.png | 0.6729 | header present, 2 card(s), sections: celebration, stats, share | Silkscreen, Silkscreen | finish_meta, grade_badge, scene, scene=sky_sunset | fixtures=RIDE_SUMMARY, dynamic values | no empty-state |
| 04_gps_diagnostics.png | 0.5544 | header present, 5 card(s) | Silkscreen | frame | fixtures=GPS_DIAG, dynamic values | no empty-state |
| 05_compete_hub.png | 0.657 | header present, tab bar, 4 card(s), sections: city_banner, city_wars, leaderboard, quests | Silkscreen, 2 | city_banner, versus_bar, crests, scene, scene=sky_sunset | fixtures=CITY_HUB, dynamic values | no empty-state |
| 06_compete_scrolled.png | 0.674 | header present, tab bar, 4 card(s), sections: city_banner, city_wars, leaderboard, quests | Silkscreen | scene, scene=sky_sunset | fixtures=CITY_HUB, dynamic values | no empty-state |
| 07_clubs.png | 0.6309 | tab bar | Silkscreen | [ ] | fixtures=NONE | empty-state active |
| 08_segments.png | 0.5481 | header present, tab bar, 3 card(s) | Silkscreen, card_count: 3 | frame | fixtures=SEGMENTS | no empty-state |
| 09_explore_hub.png | 0.5579 | header present, tab bar, 2 card(s) | Silkscreen | scene, scene=sky_day | fixtures=EXPLORE, dynamic values | no empty-state |
| 10_explore_map.png | 0.5869 | header present, tab bar | Silkscreen | map | fixtures=MAP_POI, dynamic values | no empty-state |
| 11_marketplace.png | 0.6181 | header present, tab bar, 5 card(s) | Silkscreen, card_count: 5 | frame | fixtures=MARKETPLACE, dynamic values | no empty-state |
| 12_profile.png | 0.6385 | header present, tab bar, 5 card(s), sections: hero, stats_grid, achievements, actions | Silkscreen, 1 | avatar_framed, achievement_grid, laurel_header, scene, scene=sky_night | fixtures=PROFILE, dynamic values | no empty-state |
| 13_profile_scrolled.png | 0.6342 | header present, tab bar, 5 card(s) | Silkscreen | scene, scene=sky_night | fixtures=PROFILE, dynamic values | no empty-state |
| 14_trends.png | 0.611 | tab bar, 3 card(s) | Silkscreen, Silkscreen, card_count: 3 | frame | fixtures=ACTIVITY_HISTORY, dynamic values | no empty-state |
| 15_leaderboard.png | 0.6238 | tab bar, 5 card(s) | Silkscreen, VT323, card_count: 5 | frame | fixtures=LEADERBOARD, dynamic values | no empty-state |
| 16_training_log.png | 0.5694 | header present, tab bar, 3 card(s) | Silkscreen, card_count: 3 | frame | fixtures=ACTIVITY_HISTORY, dynamic values | no empty-state |
| 19_final.png | 0.6329 | header present, tab bar, 4 card(s) | Silkscreen | scene, scene=sky_day | fixtures=RIDE_DASHBOARD, dynamic values | no empty-state |
