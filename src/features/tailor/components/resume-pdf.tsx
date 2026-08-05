/**
 * ResumeDocument — the single resume template, modelled on the "Jake's Resume"
 * LaTeX layout that most engineering resumes use.
 *
 * 📌 THIS IS NOT A WEB COMPONENT, even though it looks like one.
 * `@react-pdf/renderer` gives you React's programming model with a different
 * renderer underneath:
 *   - No Tailwind, no CSS files, no cascade. Styles come from StyleSheet.create
 *     and attach to each element explicitly.
 *   - Flexbox subset only. No grid, no float.
 *   - <View>/<Text> instead of <div>/<span>. Every string MUST sit inside a
 *     <Text> or it throws.
 *   - Built-in fonts only unless you register one. Times-Roman is used here
 *     because it is the closest built-in match to LaTeX's serif look, and it
 *     needs no network fetch at render time.
 *
 * DESIGN INTENT: ATS-optimised by construction — one column, real selectable
 * text, standard headings, no tables, no graphics, no icons. Exactly the things
 * the Week 3 analyser scores.
 */
import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
} from "@react-pdf/renderer"

import {
  normalizeUrl,
  EMPTY_LINKS,
  type ProfileLinks,
  type TailoredResume,
} from "../schema"

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 34,
    paddingHorizontal: 42,
    fontFamily: "Times-Roman",
    fontSize: 10,
    color: "#000000",
    lineHeight: 1.35,
  },

  // ---- header (centred, like the template) --------------------------------
  header: { alignItems: "center", marginBottom: 10 },
  name: {
    fontSize: 22,
    fontFamily: "Times-Bold",
    lineHeight: 1.2,
    marginBottom: 2,
  },
  headerLine: { fontSize: 9.5, lineHeight: 1.35 },
  headerLinkRow: { flexDirection: "row", marginTop: 1 },
  link: { fontSize: 9.5, color: "#0645ad", textDecoration: "underline" },
  sep: { fontSize: 9.5, marginHorizontal: 4 },

  // ---- section heading + rule ---------------------------------------------
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Times-Bold",
    // The template uses small caps; react-pdf has none, so uppercase with
    // letter-spacing is the closest honest approximation.
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 3,
    paddingBottom: 1.5,
    borderBottomWidth: 0.7,
    borderBottomColor: "#000000",
  },

  // ---- generic two-column row (content left, date right) ------------------
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  rowLeft: { flex: 1, paddingRight: 10 },
  rowRight: { fontSize: 9.5 },

  bold: { fontFamily: "Times-Bold" },
  italic: { fontFamily: "Times-Italic" },

  entry: { marginTop: 5 },

  bulletRow: { flexDirection: "row", marginTop: 1.5, paddingLeft: 8 },
  bulletMark: { width: 9 },
  bulletText: { flex: 1 },

  skillLine: { marginTop: 1.5 },
  paragraph: { marginTop: 1 },
})

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

export function ResumeDocument({
  data,
  links = EMPTY_LINKS,
}: {
  data: TailoredResume
  links?: ProfileLinks
}) {
  // Only render what the user filled in — building the list first keeps the
  // separator logic simple, with no dangling "|" after the last item.
  const profileLinks = (
    [
      { label: "GitHub", value: links.github },
      { label: "LinkedIn", value: links.linkedin },
      { label: "Portfolio", value: links.portfolio },
    ] as const
  )
    .filter((entry) => entry.value.trim().length > 0)
    .map((entry) => ({ label: entry.label, href: normalizeUrl(entry.value) }))

  return (
    <Document
      title={`${data.fullName} - Resume`}
      author={data.fullName}
      creator="CareerPilot AI"
    >
      <Page size="A4" style={styles.page}>
        {/* ---------------- header ---------------- */}
        <View style={styles.header}>
          <Text style={styles.name}>{data.fullName}</Text>
          {data.location ? (
            <Text style={styles.headerLine}>{data.location}</Text>
          ) : null}
          {data.contact ? (
            <Text style={styles.headerLine}>{data.contact}</Text>
          ) : null}

          {/* Anchor-style: the visible text is the WORD, and <Link src> attaches
              the URL as a clickable PDF annotation — same as <a href>GitHub</a>. */}
          {profileLinks.length > 0 ? (
            <View style={styles.headerLinkRow}>
              {profileLinks.map((entry, i) => (
                <View key={entry.label} style={{ flexDirection: "row" }}>
                  {i > 0 ? <Text style={styles.sep}>|</Text> : null}
                  <Link src={entry.href} style={styles.link}>
                    {entry.label}
                  </Link>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* ---------------- summary ---------------- */}
        {data.summary ? (
          <Section title="Professional Summary">
            <Text style={styles.paragraph}>{data.summary}</Text>
          </Section>
        ) : null}

        {/* ---------------- education ---------------- */}
        {data.education.length > 0 ? (
          <Section title="Education">
            {data.education.map((item, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <View style={styles.row}>
                  <Text style={[styles.rowLeft, styles.bold]}>
                    {item.institution}
                  </Text>
                  <Text style={styles.rowRight}>{item.period}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLeft}>{item.qualification}</Text>
                  {item.detail ? (
                    <Text style={styles.rowRight}>{item.detail}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        {/* ---------------- experience (only when there is any) ------------- */}
        {data.experience.length > 0 ? (
          <Section title="Experience">
            {data.experience.map((job, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <View style={styles.row}>
                  <Text style={[styles.rowLeft, styles.bold]}>{job.role}</Text>
                  <Text style={styles.rowRight}>{job.period}</Text>
                </View>
                <Text style={styles.italic}>{job.company}</Text>
                {job.bullets.map((bullet, j) => (
                  <Bullet key={j}>{bullet}</Bullet>
                ))}
              </View>
            ))}
          </Section>
        ) : null}

        {/* ---------------- technical skills ---------------- */}
        {data.skillCategories.length > 0 ? (
          <Section title="Technical Skills">
            {data.skillCategories.map((group, i) => (
              <Text key={i} style={styles.skillLine}>
                <Text style={styles.bold}>{group.category}: </Text>
                {group.items.join(", ")}
              </Text>
            ))}
          </Section>
        ) : null}

        {/* ---------------- projects ---------------- */}
        {data.projects.length > 0 ? (
          <Section title="Projects">
            {data.projects.map((project, i) => (
              // wrap={false} stops an entry being split across two pages.
              <View key={i} style={styles.entry} wrap={false}>
                <View style={styles.row}>
                  <Text style={styles.rowLeft}>
                    <Text style={styles.bold}>{project.name}</Text>
                    {project.tech ? (
                      <Text style={styles.italic}> — {project.tech}</Text>
                    ) : null}
                  </Text>
                  {project.link ? (
                    <Link src={normalizeUrl(project.link)} style={styles.link}>
                      Live Demo
                    </Link>
                  ) : null}
                </View>
                {project.bullets.map((bullet, j) => (
                  <Bullet key={j}>{bullet}</Bullet>
                ))}
              </View>
            ))}
          </Section>
        ) : null}

        {/* ---------------- certifications ---------------- */}
        {data.certifications.length > 0 ? (
          <Section title="Certifications">
            {data.certifications.map((item, i) => (
              <Bullet key={i}>{item}</Bullet>
            ))}
          </Section>
        ) : null}

        {/* ---------------- achievements ---------------- */}
        {data.achievements.length > 0 ? (
          <Section title="Achievements">
            {data.achievements.map((item, i) => (
              <Bullet key={i}>{item}</Bullet>
            ))}
          </Section>
        ) : null}
      </Page>
    </Document>
  )
}
