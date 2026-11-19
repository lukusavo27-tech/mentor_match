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

// These credentials are for local UI previews only. They are not real accounts.
export const demoPassword = "Mentor123!";

export const demoUsers = [
  { id: "mentee-tillen", name: "Tillen Otuoma", email: "tillen@example.com", role: "Mentee", status: "Active" },
  { id: "mentee-njeri", name: "Wanjiru Njeri", email: "wanjiru@example.com", role: "Mentee", status: "Active" },
  { id: "mentee-brian", name: "Brian Otieno", email: "brian@example.com", role: "Mentee", status: "Active" },
  { id: "mentor-grace", name: "Grace Wanjiku", email: "grace@example.com", role: "Mentor", status: "Active" },
  { id: "mentor-david", name: "David Mwangi", email: "david@example.com", role: "Mentor", status: "Active" },
  { id: "mentor-amina", name: "Amina Hassan", email: "amina@example.com", role: "Mentor", status: "Active" },
  { id: "admin", name: "Sam Admin", email: "admin@example.com", role: "Administrator", status: "Active" },
].map(user => ({ ...user, password: demoPassword }));
