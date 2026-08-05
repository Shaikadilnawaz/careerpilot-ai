/**
 * CoverLetterDocument — the letter PDF.
 *
 * Same renderer rules as the resume template: no CSS cascade, flexbox subset,
 * every string inside a <Text>. Built-in Helvetica so nothing is fetched at
 * render time.
 *
 * 📌 A letter is typographically different from a resume, and the styles say so:
 * wider line height and a blank line between paragraphs, because this is meant
 * to be READ as prose rather than scanned as a list.
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

import type { CoverLetterHeader } from "../schema"

const styles = StyleSheet.create({
  page: {
    paddingVertical: 52,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#1a1a1a",
    lineHeight: 1.6,
  },
  name: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.2,
    marginBottom: 3,
  },
  contact: {
    fontSize: 9,
    color: "#555555",
    lineHeight: 1.3,
  },
  meta: {
    fontSize: 10,
    color: "#444444",
    marginTop: 22,
    marginBottom: 18,
    lineHeight: 1.4,
  },
  paragraph: {
    marginBottom: 11,
  },
})

export function CoverLetterDocument({
  header,
  body,
}: {
  header: CoverLetterHeader
  body: string
}) {
  /**
   * The model separates paragraphs with a blank line. Split on one-or-more
   * blank lines and drop empties, so stray whitespace can't render as a gap.
   */
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <Document
      title={`Cover letter - ${header.company}`}
      author={header.fullName}
      creator="CareerPilot AI"
    >
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.name}>{header.fullName}</Text>
          {header.contact ? (
            <Text style={styles.contact}>{header.contact}</Text>
          ) : null}
        </View>

        <Text style={styles.meta}>
          {header.company}
          {header.role ? `\nRe: ${header.role}` : ""}
        </Text>

        {paragraphs.map((paragraph, i) => (
          <Text key={i} style={styles.paragraph}>
            {/* Single newlines inside a paragraph (like the sign-off block)
                are preserved by react-pdf, so no extra handling needed. */}
            {paragraph}
          </Text>
        ))}
      </Page>
    </Document>
  )
}
