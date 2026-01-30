import React from 'react';
import { Text, StyleSheet } from 'react-native';

const ACCENT_COLOR = '#4ADE80';

interface ParsedPart {
  text: string;
  isHighlighted: boolean;
}

export function parseCommentParts(text: string): ParsedPart[] {
  const regex = /(@\w+|#\w+|\/\w+)/g;
  const parts: ParsedPart[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.index),
        isHighlighted: false,
      });
    }
    parts.push({
      text: match[0],
      isHighlighted: true,
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      isHighlighted: false,
    });
  }

  return parts;
}

interface CommentTextProps {
  content: string;
  style?: any;
}

export function CommentText({ content, style }: CommentTextProps) {
  const parts = parseCommentParts(content);

  return (
    <Text style={style}>
      {parts.map((part, index) => (
        <Text
          key={index}
          style={part.isHighlighted ? styles.highlighted : undefined}
        >
          {part.text}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  highlighted: {
    color: ACCENT_COLOR,
  },
});
