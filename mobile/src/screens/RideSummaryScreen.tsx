import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Metric, PrimaryButton } from '../components/product';
import { RoadbookPage, RoadbookSection, RoadbookNotice, roadbookStyles as s } from '../components/roadbook/Surface';
import { getAppCopy } from '../components/roadbook/appCopy';
import { elapsedLabel, metricNumber } from '../components/roadbook/summaryPresentation';
import { useI18n } from '../i18n/useI18n';
import { isDurableRideSuccess, type RideFinishState } from '../features/ride/model/RideFinishState';
import { isVisionFixtures } from '../bootstrap/visionFixtures';

interface RideSummaryScreenProps {
  finishState: RideFinishState; username?: string; onShare?: () => void; onBackToHub?: () => void;
}
export const RideSummaryScreen: React.FC<RideSummaryScreenProps> = ({ finishState, onShare, onBackToHub }) => {
  const { locale } = useI18n();
  const c = getAppCopy(locale);
  const durableSuccess = isDurableRideSuccess(finishState);
  const summary = finishState.summary;
  const title = durableSuccess ? c.durable : finishState.kind === 'pending-finalization' ? c.pending : c.recovery;
  const message = durableSuccess ? c.durableBody : finishState.kind === 'pending-finalization' ? c.pendingBody : c.recoveryBody;
  useEffect(() => {
    if (!durableSuccess) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [durableSuccess]);
  return <RoadbookPage title={c.result} testID="ride-summary-screen" sampleLabel={isVisionFixtures() ? c.sample : undefined}
    footer={<PrimaryButton label={c.back} onPress={() => onBackToHub?.()} testID="ride-summary-back-home" />}>
    <RoadbookNotice title={title} message={message} testID={`ride-summary-${finishState.kind}`}
      error={finishState.kind === 'recovery-required'} />
    <View style={s.hero} testID="ride-summary-metrics">
      <Text style={s.caption}>{c.distance}</Text>
      <Text style={s.display} testID="ride-summary-distance">{metricNumber(summary?.distanceKm)} km</Text>
      <View style={s.metrics}>
        <View style={s.metric}><Metric label={c.duration} value={elapsedLabel(summary?.elapsedS)} testID="ride-summary-time" /></View>
        <View style={s.metric}><Metric label={c.elevation} value={`${metricNumber(summary?.elevationGainM, 0)} m`} testID="ride-summary-elevation" /></View>
      </View>
      {!summary ? <Text style={s.body} testID="ride-summary-unknown-metrics">{c.missingResult}</Text> : null}
    </View>
    {durableSuccess && onShare ? <RoadbookSection><PrimaryButton label={c.share} variant="secondary"
      onPress={onShare} testID="ride-summary-share" /></RoadbookSection> : null}
  </RoadbookPage>;
};
