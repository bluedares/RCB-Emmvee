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
    title: "RCB Match 3 (Bengaluru)",
    dateTime: "TBD",
    venue: "Bengaluru",
  },
  {
    matchId: "RCB_BLR_4",
    title: "RCB Match 4 (Bengaluru)",
    dateTime: "TBD",
    venue: "Bengaluru",
  },
  {
    matchId: "RCB_BLR_5",
    title: "RCB Match 5 (Bengaluru)",
    dateTime: "TBD",
    venue: "Bengaluru",
  },
];

function matchById(matchId) {
  return MATCHES.find((m) => m.matchId === matchId) || null;
}

module.exports = { MATCHES, matchById };

