const MATCHES = [
  {
    matchId: "RCB_BLR_1",
    title: "RCB vs SRH (Bengaluru)",
    dateTime: "Sat, 28 Mar - 7:30pm",
    venue: "Bengaluru",
    opponent: "SRH",
    matchNumber: "T20 1 of 70",
  },
  {
    matchId: "RCB_BLR_2",
    title: "RCB vs CSK (Bengaluru)",
    dateTime: "Sun, 5 Apr - 7:30pm",
    venue: "Bengaluru",
    opponent: "CSK",
    matchNumber: "T20 11 of 70",
  },
  {
    matchId: "RCB_BLR_3",
    title: "RCB vs LSG (Bengaluru)",
    dateTime: "Tue, 15 Apr - 7:30pm",
    venue: "Bengaluru",
    opponent: "LSG",
    matchNumber: "T20 23 of 70",
  },
  {
    matchId: "RCB_BLR_4",
    title: "RCB vs DC (Bengaluru)",
    dateTime: "Fri, 18 Apr - 3:30pm",
    venue: "Bengaluru",
    opponent: "DC",
    matchNumber: "T20 26 of 70",
  },
  {
    matchId: "RCB_BLR_5",
    title: "RCB vs GT (Bengaluru)",
    dateTime: "Thu, 24 Apr - 7:30pm",
    venue: "Bengaluru",
    opponent: "GT",
    matchNumber: "T20 32 of 70",
  },
];

function matchById(matchId) {
  return MATCHES.find((m) => m.matchId === matchId) || null;
}

module.exports = { MATCHES, matchById };

