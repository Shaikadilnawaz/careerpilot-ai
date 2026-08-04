/**
 * ResumeDocument — the PDF template.
 *
 * 📌 THIS IS NOT A WEB COMPONENT, even though it looks like one.
 *
 * `@react-pdf/renderer` gives you React's programming model with an entirely
 * different renderer underneath. Consequences worth knowing:
 *   - No Tailwind, no CSS files, no cascade. Styles come from `StyleSheet.create`
 *     and must be attached to each element explicitly.
 *   - Only a flexbox subset is supported. No grid, no float, no position:sticky.
 *   - `<View>` and `<Text>` instead of `<div>` and `<span>`. Every piece of text
 *     MUST be inside a <Text> — a bare string in a <View> throws.
 *   - Helvetica/Times/Courier are built in. Anything else needs Font.register
 *     with a URL, which would fail offline and slow the first render.
 *
 * So this is a separate component tree from the on-screen UI, deliberately.
 * That's the price of generating a real PDF without shipping a headless browser.
 *
 * DESIGN INTENT: this layout is ATS-optimised on purpose — single column, real
 * selectable text, standard section headings, no tables, no columns, no icons,
 * no graphics. Those are exactly the things your Week 3 analyser scores.
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"

import type { TailoredResume } from "../schema"

const styles = StyleSheet.create({
  page: {
    paddingVertical: 36,
    paddingHorizontal: 42,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
    lineHeight: 1.4,
  },
  /**
   * 📌 Set lineHeight explicitly on large text.
   *
   * The page sets lineHeight 1.4, and every child inherits it — but react-pdf
   * lays text out by BASELINE, so a 20pt name in a 1.4 box can sit low enough
   * that the next line crowds it. Pinning lineHeight and adding real margin
   * makes the header spacing predictable instead of a side effect of inherited
   * values. There's no CSS cascade to save you here.
   */
  name: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.2,
    marginBottom: 4,
  },
  headline: {
    fontSize: 11,
    color: "#444444",
    lineHeight: 1.3,
    marginBottom: 5,
  },
  contact: {
    fontSize: 9,
    color: "#555555",
    lineHeight: 1.3,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    // Uppercase headings are one of the most reliably parsed ATS conventions.
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 5,
    paddingBottom: 2,
    borderBottomWidth: 0.75,
    borderBottomColor: "#cccccc",
  },
  summary: {
    marginBottom: 2,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
  },
  entryTitle: {
    fontFamily: "Helvetica-Bold",
  },
  entryMeta: {
    color: "#555555",
    fontSize: 9,
  },
  entrySub: {
    color: "#444444",
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: "row",
    marginTop: 2,
    paddingRight: 4,
  },
  bulletMark: {
    width: 10,
  },
  bulletText: {
    flex: 1,
  },
})

/** One "• text" line. A row + flex:1 is how you get hanging indents here. */
function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

export function ResumeDocument({ data }: { data: TailoredResume }) {
  return (
    <Document
      title={`${data.fullName} - Resume`}
      author={data.fullName}
      creator="CareerPilot AI"
    >
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.name}>{data.fullName}</Text>
          {data.headline ? (
            <Text style={styles.headline}>{data.headline}</Text>
          ) : null}
          {data.contact ? (
            <Text style={styles.contact}>{data.contact}</Text>
          ) : null}
        </View>

        {data.summary ? (
          <>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summary}>{data.summary}</Text>
          </>
        ) : null}

        {data.experience.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Experience</Text>
            {data.experience.map((job, i) => (
              <View key={i} wrap={false}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>{job.role}</Text>
                  <Text style={styles.entryMeta}>{job.period}</Text>
                </View>
                <Text style={styles.entrySub}>{job.company}</Text>
                {job.bullets.map((bullet, j) => (
                  <Bullet key={j}>{bullet}</Bullet>
                ))}
              </View>
            ))}
          </>
        ) : null}

        {data.projects.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Projects</Text>
            {data.projects.map((project, i) => (
              // wrap={false} keeps an entry from being split across pages.
              <View key={i} wrap={false}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>{project.name}</Text>
                </View>
                {project.tech ? (
                  <Text style={styles.entrySub}>{project.tech}</Text>
                ) : null}
                {project.bullets.map((bullet, j) => (
                  <Bullet key={j}>{bullet}</Bullet>
                ))}
              </View>
            ))}
          </>
        ) : null}

        {data.skills.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Skills</Text>
            {/* A plain comma-separated line, NOT a multi-column grid — ATS
                parsers routinely mangle columns into unreadable word soup. */}
            <Text>{data.skills.join(", ")}</Text>
          </>
        ) : null}

        {data.education.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Education</Text>
            {data.education.map((item, i) => (
              <View key={i}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>{item.qualification}</Text>
                  <Text style={styles.entryMeta}>{item.period}</Text>
                </View>
                {item.institution ? (
                  <Text style={styles.entrySub}>{item.institution}</Text>
                ) : null}
              </View>
            ))}
          </>
        ) : null}
      </Page>
    </Document>
  )
}
