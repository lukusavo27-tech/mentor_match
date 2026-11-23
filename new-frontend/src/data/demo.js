export const demoLoginPassword = "MentorMatchDemo2026!";

export const demoAccounts = [
  { id: "10000000-0000-4000-8000-000000000001", name: "Grace Wanjiku", email: "grace.mentor@example.test", role: "mentor" },
  { id: "10000000-0000-4000-8000-000000000002", name: "David Mwangi", email: "david.mentor@example.test", role: "mentor" },
  { id: "10000000-0000-4000-8000-000000000003", name: "Amina Hassan", email: "amina.mentor@example.test", role: "mentor" },
  { id: "10000000-0000-4000-8000-000000000004", name: "Peter Otieno", email: "peter.mentor@example.test", role: "mentor" },
  { id: "20000000-0000-4000-8000-000000000001", name: "Tillen Otuoma", email: "tillen.mentee@example.test", role: "graduate", goal: "Backend engineering" },
  { id: "20000000-0000-4000-8000-000000000002", name: "Njeri Kamau", email: "njeri.mentee@example.test", role: "graduate", goal: "Data science" },
  { id: "20000000-0000-4000-8000-000000000003", name: "Brian Kiptoo", email: "brian.mentee@example.test", role: "graduate", goal: "Cloud security" }
];

export const demoMentees = demoAccounts.filter((account) => account.role === "graduate");

export const demoMentors = [
  { id: 1, name: "Grace Wanjiku", role: "Senior Software Engineer", company: "Safaricom", initials: "GW", score: 96, tags: ["Software Engineering", "Cloud", "Python"], experience: "9 years", location: "Nairobi, Kenya" },
  { id: 2, name: "David Mwangi", role: "Data & AI Lead", company: "Andela", initials: "DM", score: 91, tags: ["Machine Learning", "Python", "Analytics"], experience: "7 years", location: "Nairobi, Kenya" },
  { id: 3, name: "Amina Hassan", role: "Product Manager", company: "M-KOPA", initials: "AH", score: 87, tags: ["Product Strategy", "UX", "Leadership"], experience: "8 years", location: "Remote" }
];

export const demoStats = [
  { label: "Profile completeness", value: "85%", note: "Almost there" },
  { label: "Potential mentors", value: "24", note: "Based on your profile" },
  { label: "Saved mentors", value: "06", note: "Your shortlist" }
];
