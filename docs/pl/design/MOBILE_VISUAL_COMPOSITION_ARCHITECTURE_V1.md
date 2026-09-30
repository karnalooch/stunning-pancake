# 4VELO Mobile Visual Composition Architecture v1 — podsumowanie PL

| | |
|---|---|
| **Status** | APPROVED / NORMATIVE / CURRENT |
| **Data decyzji** | 2026-09-30 |
| **Owner** | Product / Mobile / Design |
| **Tracker** | #397 |
| **Nadrzędny product authority** | [Product UX v2](../../design/PRODUCT_UX_V2.md) |
| **Wersja kanoniczna** | [English](../../design/MOBILE_VISUAL_COMPOSITION_ARCHITECTURE_V1.md) |

## Zasada

**Najpierw kompozycja, potem asset.**

```text
Product UX v2
 -> state/controller
 -> kompozycja
      map plane
      data plane
      control plane
      brand/emotion plane
 -> tokeny / komponenty / assety
```

Brand/emotion jest warstwą opcjonalną. Nie może być potrzebny do zrozumienia mapy, metryk, akcji ani błędu.

## Kolejność authority

1. Product UX v2 — IA i user journey.
2. Mobile Visual Composition Architecture v1 — hierarchia ekranu i role plane'ów.
3. Mobile UI Design Contract v1.2 — kolor, typografia, czytelność, touch targety.
4. Asset Bible / Production List / machine governance — role i provenance assetów.
5. Stare Frozen UI/audyty/mockupy — evidence historyczne.

## Asset-off test

Wyłącz opcjonalne JPG/PNG. Ekran nadal musi być zrozumiały, hierarchiczny, operowalny i prawdziwy.

Jeżeli po wyłączeniu artu znika primary action, układ się rozsypuje albo nie wiadomo co zrobić — naprawiamy kompozycję, **nie generujemy kolejnego obrazka**.

## Today

- jeden dominujący Start Ride;
- najwyżej jeden hero/brand moment w pierwszym viewport;
- bounded recent/current context;
- bez dashboardowego śmietnika.

## Start Ride

- sport/profile;
- GPS/sensors/offline readiness;
- route/workout jeżeli potrzebne;
- wielki START;
- diagnostyka tylko gdy blokuje start.

## Active Ride

Priorytet:

1. guidance/map;
2. hero metric;
3. 2–3 secondary metrics;
4. GPS/recovery tylko gdy ma znaczenie;
5. Pause;
6. chroniony Finish.

Nie pokazujemy edit-mode, profili layoutu ani równorzędnej siatki kart podczas zwykłej jazdy.

## Paused

To stan Active Ride, nie osobny produktowy ekran.

- Ride pozostaje rozpoznawalny pod spodem;
- overlay/sheet;
- RESUME = dominant;
- FINISH = protected/destructive;
- docelowo stan pochodzi z #392, nie z lokalnego flag UI.

## Summary

Najpierw terminal truth, wynik, route/effort context, metryki i next action. Dopiero potem optional celebration.

`summary_finish_v1` i inne celebracyjne assety tylko dla `durable-success`.

## Approved assety

| Asset | Decyzja |
|---|---|
| `rider_canonical_v1` | KEEP / specialist only |
| `home_hero_day_v1` | KEEP / bounded |
| `place_badge_v1` | KEEP |
| `ride_marker_rider_v1` | KEEP / bounded map marker |
| `ride_action_icons_v1` | KEEP / functional |
| `summary_finish_v1` | KEEP / durable-success only |

Żaden approved asset nie jest argumentem, żeby budować ekran wokół niego.

## Planned asset hold

Nowy dekoracyjny asset powstaje dopiero, gdy issue odpowie:

1. jaka luka kompozycji istnieje;
2. dlaczego layout/type/icon/map/data nie wystarcza;
3. do którego plane'u należy asset;
4. co się dzieje bez assetu;
5. jaki jest realny render slot;
6. accessibility/reduced-motion impact.

W przeciwnym razie zostaje `planned`.

## Referencje

Nie kopiujemy wyglądu; kopiujemy pytania i ograniczenia.

- Mapbox Navigation UX Framework: https://docs.mapbox.com/android/navigation/ux/guides/
- Mapbox UXF video: https://www.youtube.com/watch?v=uTXUqf3MIJ0
- Uber Driver App architecture: https://www.uber.com/gb/en/blog/driver-app-ribs-architecture/
- Wahoo design-system redesign: https://medium.com/wahoo-product-design/wahoo-releases-biggest-software-update-yet-c67fa22f1034
- Wahoo workout display notes: https://medium.com/wahoo-product-design/elemnt-rival-b988b486529e
- Hammerhead Karoo review: https://www.youtube.com/watch?v=RchsWNofg1Q

## Jedno zdanie

> **4VELO ma wyglądać na kompletny produkt zanim załadują się obrazki; obrazki mają sprawić, że będzie rozpoznawalnie 4VELO, a nie dopiero używalne.**
