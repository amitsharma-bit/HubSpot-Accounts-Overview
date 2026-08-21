/**
 * Centralized team/member configuration. This is the single source of truth for
 * owner -> team/role mapping. Add / rename / move a person by editing this file —
 * no logic elsewhere in the app hardcodes names, teams, or roles.
 *
 * ownerIds is an array (not a scalar) because HubSpot owner records can be
 * duplicated (e.g. a name change creates a second owner record for the same
 * human). Dave Purgason maps to two IDs for exactly this reason — see `note`.
 */

export type Role = "SDR" | "AE" | "SDR TL" | "Manager" | "Team Lead" | "AM" | "Other";

export type RosterMember = {
  ownerIds: number[];
  name: string;
  role: Role;
  team: string;
  note?: string;
};

export const TEAMS = [
  "Archit Team",
  "Saarthak Team",
  "Neelima Team",
  "Prince Team",
  "Central/Unassigned",
] as const;

/**
 * Non-human bulk-import / holding-bucket owners. These own real US accounts but
 * are never reps — they get their own labeled bucket in the UI, kept separate
 * from both team totals and the genuine "Unmapped Owner" list. See
 * src/lib/aggregate.ts and the Control Center page.
 */
export const SYSTEM_OWNERS: Record<number, string> = {
  163826942: "salesops . (bulk import / holding bucket)",
};

export const ROSTER: RosterMember[] = [
  // Archit Team
  { ownerIds: [69016314], name: "Rajveer Singh", role: "AM", team: "Archit Team" },
  { ownerIds: [67333606], name: "Archit Gupta", role: "Team Lead", team: "Archit Team" },
  { ownerIds: [160043135], name: "Drishti Aggarwal", role: "SDR", team: "Archit Team" },
  { ownerIds: [160673631], name: "Vaansh Sharma", role: "SDR", team: "Archit Team" },
  { ownerIds: [167097715], name: "Gagan Raj", role: "AE", team: "Archit Team" },
  { ownerIds: [66975998], name: "Sanamdeep", role: "SDR", team: "Archit Team" },
  { ownerIds: [160575588], name: "Liam Fallon", role: "AE", team: "Archit Team" },
  { ownerIds: [81615528], name: "Jayant Trivedi", role: "SDR", team: "Archit Team" },
  { ownerIds: [160768701], name: "Jace Larsen", role: "AE", team: "Archit Team" },

  // Saarthak Team
  { ownerIds: [163855147], name: "Gagandeep Kaur", role: "SDR", team: "Saarthak Team" },
  { ownerIds: [76546199], name: "Nam Harrison", role: "SDR", team: "Saarthak Team" },
  { ownerIds: [67309901], name: "Ankur Patel", role: "AE", team: "Saarthak Team" },
  { ownerIds: [165126708], name: "Lakshya Gaurh", role: "SDR", team: "Saarthak Team" },
  { ownerIds: [159865948], name: "Ashish Baweja", role: "SDR", team: "Saarthak Team" },
  { ownerIds: [71105578], name: "Rishabh Sharma", role: "AE", team: "Saarthak Team" },
  { ownerIds: [60199598], name: "Jay Berry", role: "AE", team: "Saarthak Team" },
  { ownerIds: [67442992], name: "Saarthak Seth", role: "Team Lead", team: "Saarthak Team" },
  { ownerIds: [77266515], name: "Vikram Choudhary", role: "SDR", team: "Saarthak Team" },
  { ownerIds: [159761343], name: "Viplove Tyagi", role: "SDR", team: "Saarthak Team" },

  // Neelima Team
  {
    ownerIds: [163258461, 79690525],
    name: "Dave Purgason",
    role: "Team Lead",
    team: "Neelima Team",
    note: "Merged legacy owner record 79690525 (\"David Purgason\") into this entry.",
  },
  { ownerIds: [70740200], name: "Priyanka Sambyal", role: "SDR", team: "Neelima Team" },
  { ownerIds: [68537322], name: "Pallav Pandey", role: "AE", team: "Neelima Team" },
  { ownerIds: [159882968], name: "Jatin Arora", role: "AE", team: "Neelima Team" },
  { ownerIds: [82407666], name: "Arun Divya Prakash", role: "AE", team: "Neelima Team" },
  { ownerIds: [159458372], name: "Simran Grover", role: "SDR", team: "Neelima Team" },
  { ownerIds: [159458371], name: "Vaibhav Kumar", role: "Manager", team: "Neelima Team" },
  { ownerIds: [60656445], name: "Vans K", role: "AE", team: "Neelima Team" },
  { ownerIds: [160214774], name: "Anisha Jaiswal", role: "SDR", team: "Neelima Team" },
  { ownerIds: [164380450], name: "Shubham Singha", role: "SDR", team: "Neelima Team" },
  { ownerIds: [27537035], name: "Neelima Tiwari", role: "Team Lead", team: "Neelima Team" },
  { ownerIds: [161262717], name: "Jenieray S Fedorovich", role: "Other", team: "Neelima Team" },
  { ownerIds: [62715106], name: "Kshitij Agarwal", role: "SDR TL", team: "Neelima Team" },
  { ownerIds: [160353848], name: "utsav Yadav", role: "SDR", team: "Neelima Team" },
  { ownerIds: [79785093], name: "Shikhar Paroha", role: "SDR TL", team: "Neelima Team" },

  // Prince Team
  { ownerIds: [68537320], name: "Ketan Srivastava", role: "AE", team: "Prince Team" },
  { ownerIds: [165725658], name: "Angad Bawa", role: "SDR", team: "Prince Team" },
  { ownerIds: [61267720], name: "Prince Arora", role: "Team Lead", team: "Prince Team" },
  { ownerIds: [164014269], name: "Palak Narula", role: "SDR", team: "Prince Team" },
  { ownerIds: [164019464], name: "Kreeti Chhabra", role: "SDR", team: "Prince Team" },

  // Central/Unassigned
  { ownerIds: [165725776], name: "Animesh Anand", role: "SDR", team: "Central/Unassigned" },
  { ownerIds: [166643021], name: "Ayushi Rawat", role: "SDR", team: "Central/Unassigned" },
  { ownerIds: [167028759], name: "Lovely Sahoo", role: "SDR", team: "Central/Unassigned" },
  { ownerIds: [166522268], name: "Sahil Bakshi", role: "SDR", team: "Central/Unassigned" },
  { ownerIds: [79900347], name: "Shadman Khalid", role: "SDR", team: "Central/Unassigned" },
  { ownerIds: [165867085], name: "Sourav Singh", role: "SDR", team: "Central/Unassigned" },
];

/** ownerId -> roster entry, flattening the ownerIds arrays. Built once at module load. */
export const OWNER_TO_MEMBER: Map<number, RosterMember> = new Map(
  ROSTER.flatMap((member) => member.ownerIds.map((id) => [id, member] as const))
);

export const ROSTER_OWNER_IDS: Set<number> = new Set(OWNER_TO_MEMBER.keys());

export const MERGED_MEMBERS = ROSTER.filter((m) => m.ownerIds.length > 1);
