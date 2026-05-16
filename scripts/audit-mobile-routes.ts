/**
 * Mobile Screen Parity — compares screens in mobile/src/screens/ with the plan
 * defined in plans/screen-architecture-plan.md.
 *
 * Detects: plan screens not yet implemented, implemented screens not in plan.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SCREEN_DIR = resolve(ROOT, 'mobile/src/screens');
const PLAN_FILE = resolve(ROOT, 'plans/screen-architecture-plan.md');

/* ─── Screens expected per the plan ────────────────────────── */
const PLANNED_SCREENS: string[] = [
  'OnboardingScreen',       // SetupScreen in auth group
  'RideDashboardScreen',
  'ActiveRideHUDScreen',
  'RidePausedScreen',
  'RideSummaryScreen',
  'GlobalLeaderboardScreen',
  'CityHubScreen',
  'SegmentsScreen',
  'ExploreMapScreen',
  'ClubsDirectoryScreen',
  'MarketplaceScreen',
  'AthleteProfileScreen',
  'TrainingLogScreen',
  'PerformanceTrendsScreen',
  'ActivityDetailScreen',
  'SettingsScreen',
];

/* ─── Main ──────────────────────────────────────────────────── */
function main(): never {
  console.log('\n═══ Mobile Screen Parity ═══\n');

  // Gather actual screens
  const actualScreens: string[] = [];
  if (existsSync(SCREEN_DIR)) {
    const entries = readdirSync(SCREEN_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.tsx')) {
        actualScreens.push(entry.name.replace('.tsx', ''));
      }
    }
  }
  const actualSet = new Set(actualScreens);
  const plannedSet = new Set(PLANNED_SCREENS);

  console.log(`Expected in plan: ${PLANNED_SCREENS.length}`);
  console.log(`Found in screens/: ${actualScreens.length}\n`);

  let errors = 0;
  let warnings = 0;

  // Screens in plan but missing from code
  console.log('─── Missing screens (in plan, not in code) ───');
  for (const planned of PLANNED_SCREENS) {
    if (!actualSet.has(planned)) {
      console.log(`  ❌  MISSING: ${planned} — expected by plan, no file found`);
      errors++;
    }
  }
  if (PLANNED_SCREENS.every((s) => actualSet.has(s))) {
    console.log('  ✅  All planned screens present');
  }

  // Screens in code but not in plan
  console.log('\n─── Extra screens (in code, not in plan) ───');
  for (const actual of actualScreens) {
    if (!plannedSet.has(actual)) {
      console.log(`  ⚠️  EXTRA: ${actual} — exists but not in screen-architecture-plan.md`);
      warnings++;
    }
  }
  if (actualScreens.every((s) => plannedSet.has(s))) {
    console.log('  ✅  No extra screens');
  }

  // Also check the plan roadmap phases against actuals
  console.log('\n─── Phase completion check ───');
  const phase1screens = ['RideDashboardScreen', 'ActiveRideHUDScreen', 'RideSummaryScreen', 'CityHubScreen', 'ActivityDetailScreen'];
  const phase2screens = ['RidePausedScreen', 'GlobalLeaderboardScreen', 'MarketplaceScreen', 'AthleteProfileScreen', 'TrainingLogScreen'];
  const phase3screens = ['SegmentsScreen', 'ExploreMapScreen', 'ClubsDirectoryScreen', 'PerformanceTrendsScreen', 'SettingsScreen'];

  for (const [phase, screens] of [['Phase 1 (P0)', phase1screens], ['Phase 2 (P1)', phase2screens], ['Phase 3 (P2)', phase3screens]] as const) {
    const complete = screens.filter((s) => actualSet.has(s)).length;
    const total = screens.length;
    const done = complete === total;
    console.log(`  ${done ? '✅' : '⚠️'} ${phase}: ${complete}/${total} screens`);
    if (!done) {
      for (const s of screens) {
        if (!actualSet.has(s)) console.log(`      missing: ${s}`);
      }
    }
  }

  console.log(`\n─── Results: ${errors} errors, ${warnings} warnings ───`);
  if (errors > 0) {
    console.log('🔴 AUDIT FAILED\n');
    process.exit(1);
  }
  console.log(warnings > 0 ? '🟡 Passed with warnings\n' : '🟢 All clear\n');
  process.exit(0);
}

main();
