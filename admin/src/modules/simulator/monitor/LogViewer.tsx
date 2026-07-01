import React, { useEffect, useRef } from 'react';
import { ScrollArea, Text } from '@mantine/core';

export type LogEntry = [string, string];

interface LogViewerProps {
    batchLog?: LogEntry[];
    liveLog?: LogEntry[];
    garminLog?: LogEntry[];
    height?: number;
}

function logColor(source: 'batch' | 'live' | 'garmin', msg: string): string {
    if (msg.includes('ERROR')) return '#f85149';
    if (source === 'live') {
        const lower = msg.toLowerCase();
        if (
            lower.includes('unroutable start')
            || lower.includes('road-only mode: skipped')
            || lower.includes('pass=0')
            || lower.includes('target island')
        ) {
            return '#d29922';
        }
        return '#8b949e';
    }
    if (source === 'batch') return msg.includes('ERROR') ? '#f85149' : '#58a6ff';
    return msg.toLowerCase().includes('error') ? '#f85149' : '#8b949e';
}

export const LogViewer: React.FC<LogViewerProps> = ({
    batchLog = [],
    liveLog = [],
    garminLog = [],
    height = 220,
}) => {
    const endRef = useRef<HTMLDivElement>(null);
    const hasLogs = batchLog.length + liveLog.length + garminLog.length > 0;

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [batchLog, liveLog, garminLog]);

    if (!hasLogs) return null;

    return (
        <ScrollArea
            h={height}
            style={{
                background: '#0d1117',
                borderRadius: 8,
                padding: 12,
                fontFamily: 'monospace',
            }}
        >
            {batchLog.map(([ts, msg], i) => (
                <Text
                    key={`b-${i}`}
                    size="2xs"
                    style={{ color: logColor('batch', msg), lineHeight: 1.5 }}
                >
                    <Text span c="dimmed" size="2xs">[{ts}]</Text> {msg}
                </Text>
            ))}
            {liveLog.map(([ts, msg], i) => (
                <Text
                    key={`l-${i}`}
                    size="2xs"
                    style={{ color: logColor('live', msg), lineHeight: 1.5 }}
                >
                    <Text span c="dimmed" size="2xs">[L {ts}]</Text> {msg}
                </Text>
            ))}
            {garminLog.map(([ts, msg], i) => (
                <Text
                    key={`g-${i}`}
                    size="2xs"
                    style={{ color: logColor('garmin', msg), lineHeight: 1.5 }}
                >
                    <Text span c="dimmed" size="2xs">[G {ts}]</Text> {msg}
                </Text>
            ))}
            <div ref={endRef} />
        </ScrollArea>
    );
};
