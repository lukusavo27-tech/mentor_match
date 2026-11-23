export const demoLoginPassword = "MentorMatchDemo2026!";

export const demoAccounts = [
  { id: "10000000-0000-4000-8000-000000000001", name: "Grace Wanjiku", email: "grace.mentor@example.test", role: "mentor" },
  { id: "10000000-0000-4000-8000-000000000002", name: "David Mwangi", email: "david.mentor@example.test", role: "mentor" },
  { id: "10000000-0000-4000-8000-000000000003", name: "Amina Hassan", email: "amina.mentor@example.test", role: "mentor" },
  { id: "10000000-0000-4000-8000-000000000004", name: "Peter Otieno", email: "peter.mentor@example.test", role: "mentor" },
  { id: "10000000-0000-4000-8000-000000000005", name: "Fatima Njoroge", email: "fatima.mentor@example.test", role: "mentor" },
  { id: "10000000-0000-4000-8000-000000000006", name: "Samuel Kariuki", email: "samuel.mentor@example.test", role: "mentor" },
  { id: "10000000-0000-4000-8000-000000000007", name: "Wanjiru Muthoni", email: "wanjiru.mentor@example.test", role: "mentor" },
  { id: "10000000-0000-4000-8000-000000000008", name: "James Ouma", email: "james.mentor@example.test", role: "mentor" },
  { id: "10000000-0000-4000-8000-000000000009", name: "Joseph Kamau", email: "joseph.mentor@example.test", role: "mentor" },
  { id: "20000000-0000-4000-8000-000000000001", name: "Tillen Otuoma", email: "tillen.mentee@example.test", role: "graduate", goal: "Backend engineering" },
  { id: "20000000-0000-4000-8000-000000000002", name: "Njeri Kamau", email: "njeri.mentee@example.test", role: "graduate", goal: "Data science" },
  { id: "20000000-0000-4000-8000-000000000003", name: "Brian Kiptoo", email: "brian.mentee@example.test", role: "graduate", goal: "Cloud security" },
  { id: "20000000-0000-4000-8000-000000000004", name: "Leah Otieno", email: "leah.mentee@example.test", role: "graduate", goal: "Frontend engineering" },
  { id: "20000000-0000-4000-8000-000000000005", name: "Kevin Kiptoo", email: "kevin.mentee@example.test", role: "graduate", goal: "Finance and fintech" },
  { id: "20000000-0000-4000-8000-000000000006", name: "Zawadi Abdalla", email: "zawadi.mentee@example.test", role: "graduate", goal: "Agricultural data science" },
  { id: "20000000-0000-4000-8000-000000000007", name: "Mercy Chebet", email: "mercy.mentee@example.test", role: "graduate", goal: "Healthcare informatics" },
  { id: "20000000-0000-4000-8000-000000000008", name: "Asha Wairimu", email: "asha.mentee@example.test", role: "graduate", goal: "Education project management" }
];

export const demoMentees = demoAccounts.filter((account) => account.role === "graduate");
export const demoMentors = demoAccounts.filter((account) => account.role === "mentor");

export const demoStats = [
  { label: "Profile completeness", value: "85%", note: "Almost there" },
  { label: "Potential mentors", value: "0", note: "Live recommendations" },
  { label: "Saved mentors", value: "0", note: "Build your shortlist" }
];
