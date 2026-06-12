import React from 'react';
import { Title, Text, Table, List, Anchor, Box, Divider } from '@mantine/core';

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const href = linkMatch[2];
      const isExternal = href.startsWith('http');
      return (
        <Anchor key={i} href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noopener noreferrer' : undefined}>
          {linkMatch[1]}
        </Anchor>
      );
    }
    return part;
  });
}

function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
}

export const SimpleMarkdown: React.FC<{ source: string }> = ({ source }) => {
  const lines = source.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('---')) {
      nodes.push(<Divider key={key++} my="md" />);
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      const id = line
        .slice(3)
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      nodes.push(
        <Title key={key++} order={2} mt="xl" mb="sm" id={id}>
          {inlineFormat(line.slice(3))}
        </Title>,
      );
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      nodes.push(
        <Title key={key++} order={3} mt="lg" mb="xs">
          {inlineFormat(line.slice(4))}
        </Title>,
      );
      i++;
      continue;
    }

    if (line.startsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const headers = parseTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      nodes.push(
        <Table key={key++} striped withTableBorder mb="md">
          <Table.Thead>
            <Table.Tr>
              {headers.map((h, hi) => (
                <Table.Th key={hi}>{inlineFormat(h)}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row, ri) => (
              <Table.Tr key={ri}>
                {row.map((cell, ci) => (
                  <Table.Td key={ci}>{inlineFormat(cell)}</Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>,
      );
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <List key={key++} mb="md">
          {items.map((item, li) => (
            <List.Item key={li}>{inlineFormat(item)}</List.Item>
          ))}
        </List>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      nodes.push(
        <List key={key++} type="ordered" mb="md">
          {items.map((item, li) => (
            <List.Item key={li}>{inlineFormat(item)}</List.Item>
          ))}
        </List>,
      );
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    if (line.startsWith('# ')) {
      i++;
      continue;
    }

    if (line.startsWith('|') && line.includes('|')) {
      i++;
      continue;
    }

    nodes.push(
      <Text key={key++} mb="sm" size="sm" style={{ lineHeight: 1.6 }}>
        {inlineFormat(line)}
      </Text>,
    );
    i++;
  }

  return <Box>{nodes}</Box>;
};
